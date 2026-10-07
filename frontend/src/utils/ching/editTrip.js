// Ching voice editing — applies parsed edit actions to the Trip Builder's own
// state (the "snapshot": tripInfo, itinerary, accommodations, transportation,
// tripActivities, pricing percentages) and describes what changed.
//
// Pure JS: no React, no DOM, no network. The input snapshot is never mutated.
//
// Semantics in short: the trip is a timeline of days (day d = startDate + d-1,
// its night belongs to the stay whose [checkIn, checkOut) holds that date).
// Changing a stay's nights inserts/deletes days at the end of that stay's
// block and shifts everything after it — hotels, day plan, cabs, activities —
// then re-titles the days that still carry Ching's auto titles.
//
// Stay indexes, activity indexes and day numbers in a batch all refer to the
// trip as it was BEFORE the batch (i.e. to buildEditContext(snapshot)), so a
// parser can emit several actions from one context without re-indexing.
import {
  hotelRoomTypes,
  findRoomTypeSection,
  bedPricesFromSection,
  hotelCategoryLabel,
  toRoomTypeSlug,
} from '../hotelRates.js'
import {
  normDate,
  addDays,
  diffDays,
  fmtDay,
  fmtRange,
  money,
  plural,
  clone,
  newId,
  sameName,
  toInt,
  isCancelled,
  nightsOf,
  getStays,
  sortDays,
  stripDayPrefix,
  dayLines,
  setLines,
  LEISURE_LINE,
  findById,
  findByName,
  MEAL_PLANS,
} from './editTripUtil.js'
import {
  dateOfDay,
  dayOfDate,
  isFullTripCab,
  routeOf,
  isAutoTitle,
  addKnown,
  staySequence,
  blockCab,
  anyDayCab,
  insertDays,
  deleteRange,
  finishStructural,
  cabLine,
} from './editTripTimeline.js'
import { bestStayOrder } from './route.js'
import { rankHotelsForCity } from './places.js'

const COMMANDS = new Set(['EXPORT_PDF', 'EMAIL_ME', 'SAVE', 'UNDO'])

/* ───────────────────────────── context ───────────────────────────── */

function totalNights(snapshot) {
  const d = parseInt(snapshot?.tripInfo?.duration, 10)
  if (Number.isFinite(d) && d > 0) return d
  const days = (snapshot?.itinerary || []).length
  if (days > 1) return days - 1
  return getStays(snapshot?.accommodations).reduce((sum, a) => sum + (Math.max(0, nightsOf(a)) || 0), 0)
}

function mostCommonVehicle(transportation) {
  const counts = new Map()
  for (const t of transportation || []) {
    if (t?.vehicleId == null && !t?.vehicleType) continue
    const key = t.vehicleId != null ? `id:${t.vehicleId}` : `name:${t.vehicleType}`
    const entry = counts.get(key) || { n: 0, t }
    entry.n += 1
    counts.set(key, entry)
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0]
  return best ? { id: best.t.vehicleId ?? null, name: best.t.vehicleType || '' } : null
}

/** What the edit parser sees: a compact, index-addressable view of the open trip. */
export function buildEditContext(snapshot) {
  const s = snapshot || {}
  const ti = s.tripInfo || {}
  const accs = (s.accommodations || []).map((a) => ({
    ...a,
    checkIn: normDate(a.checkIn),
    checkOut: normDate(a.checkOut),
  }))
  const stays = getStays(accs).map((a, index) => {
    const n = nightsOf(a)
    return {
      index,
      hotelId: a.hotelId ?? null,
      hotelName: a.name || '',
      city: a.city || '',
      nights: Number.isFinite(n) ? n : 0,
      mealPlan: a.mealPlan || '',
      checkIn: a.checkIn,
      checkOut: a.checkOut,
    }
  })
  const days = sortDays(s.itinerary).map((d, i) => ({
    day: i + 1,
    title: d.title || '',
    location: d.location || '',
    activities: dayLines(d),
  }))
  const activities = (s.tripActivities || []).map((a, index) => ({
    index,
    name: a.name || '',
    dayNumber: a.dayNumber === '' || a.dayNumber == null ? '' : Number(a.dayNumber),
    location: a.location || '',
  }))
  return {
    tripId: ti.tripId ?? null,
    clientName: ti.clientName || '',
    startDate: normDate(ti.startDate),
    nights: totalNights(s),
    adults: Number(ti.adults) || 0,
    children: Number(ti.kids5to12) || 0,
    infants: Number(ti.kidsUpto5) || 0,
    stays,
    days,
    activities,
    vehicle: mostCommonVehicle(s.transportation),
    marginPercent: Number(s.profitMarginPercentage) || 0,
    gstPercent: Number(s.gstPercentage) || 0,
    includeGst: s.includeGST !== false,
  }
}

/* ───────────────────────────── helpers ───────────────────────────── */

function prepare(snapshot) {
  const s = clone(snapshot || {})
  s.tripInfo = s.tripInfo || {}
  s.itinerary = sortDays(s.itinerary)
  s.accommodations = s.accommodations || []
  s.transportation = s.transportation || []
  s.tripActivities = s.tripActivities || []
  const fix = (obj, key) => {
    const d = normDate(obj[key])
    if (d) obj[key] = d
  }
  fix(s.tripInfo, 'startDate')
  s.accommodations.forEach((a) => {
    fix(a, 'checkIn')
    fix(a, 'checkOut')
  })
  s.transportation.forEach((t) => fix(t, 'date'))
  return s
}

const guestCount = (s) => (Number(s.tripInfo.adults) || 0) + (Number(s.tripInfo.kids5to12) || 0)
const hotelStay = (acc) => `${acc.city || acc.name || 'Hotel'}`

function stayAt(st, idx) {
  const i = toInt(idx)
  const acc = Number.isInteger(i) && i >= 0 ? st.origStays[i] : null
  if (!acc) {
    st.warnings.push(`There is no stay #${Number.isInteger(i) ? i + 1 : idx} on this trip`)
    return null
  }
  if (!st.s.accommodations.includes(acc)) {
    st.warnings.push(`The ${hotelStay(acc)} stay was already removed`)
    return null
  }
  return acc
}

/** Day number from the pre-batch context -> { day, n } in the current plan. */
function dayAt(st, value) {
  const n = toInt(value)
  if (!Number.isInteger(n) || n < 1) {
    st.warnings.push(`"${value}" is not a day number`)
    return null
  }
  if (n <= st.origDays.length) {
    const day = st.origDays[n - 1]
    const pos = st.s.itinerary.indexOf(day)
    if (pos < 0) {
      st.warnings.push(`Day ${n} was removed by an earlier change`)
      return null
    }
    return { day, n: pos + 1 }
  }
  if (n <= st.s.itinerary.length) return { day: st.s.itinerary[n - 1], n }
  st.warnings.push(`The trip has only ${plural(st.s.itinerary.length, 'day')} — there is no day ${n}`)
  return null
}

function needDates(st, acc) {
  if (!normDate(st.s.tripInfo.startDate)) {
    st.warnings.push('The trip has no start date — set one first')
    return false
  }
  if (acc && !(nightsOf(acc) >= 0)) {
    st.warnings.push(`The ${hotelStay(acc)} stay has no valid check-in/check-out dates`)
    return false
  }
  return true
}

const cityOfDay = (st, day, n) => {
  if (day.location) return day.location
  const date = dateOfDay(st, n)
  return getStays(st.s.accommodations).find((a) => a.checkIn <= date && date < a.checkOut)?.city || ''
}

/** Reprice a stay whose check-in moved, if it was still on the rate-sheet price. */
function repriceForDates(st, acc, oldCheckIn) {
  const hotel = findById(st.catalog.hotels, acc.hotelId)
  if (!hotel || !acc.roomType || !acc.checkIn) return
  const oldSection = findRoomTypeSection(hotel, acc.roomType, oldCheckIn)
  const section = findRoomTypeSection(hotel, acc.roomType, acc.checkIn)
  if (section.price == null) return
  const current = Number(acc.pricePerRoom) || 0
  if ((Number(oldSection.price) || 0) !== current) return // hand-edited price: leave it alone
  if (Number(section.price) === current) return
  acc.pricePerRoom = section.price
  acc.bedPrices = bedPricesFromSection(section)
  st.warnings.push(
    `${hotelStay(acc)} hotel rate is now ${money(section.price)}/room/night for the new dates (was ${money(current)})`,
  )
}

function stayNightsLine(st, acc, before) {
  const after = nightsOf(acc)
  st.changes.push(`${hotelStay(acc)}: ${before} → ${plural(after, 'night')} (${fmtRange(acc.checkIn, acc.checkOut)})`)
}

/** Grow (k > 0) or shrink (k < 0) one stay by k nights. Pushes the change lines. */
function changeStayNights(st, acc, k) {
  if (!k) return true
  const before = nightsOf(acc)
  if (before + k < 1) {
    st.warnings.push(`${hotelStay(acc)} can't have fewer than 1 night — remove the stay instead`)
    return false
  }
  if (st.nights + k < 1) {
    st.warnings.push('A trip needs at least 1 night')
    return false
  }
  const seq = staySequence(st)
  let added = 0
  let removed = 0
  const addedDates = []
  if (k > 0) {
    const pivot = acc.checkOut
    const cab = blockCab(st, acc)
    added = insertDays(st, pivot, k, acc.city || '', { extendAcc: acc, cab })
    for (let j = 0; j < added; j += 1) addedDates.push(addDays(pivot, j))
  } else {
    removed = deleteRange(st, addDays(acc.checkOut, k), -k)
  }
  st.nights += k
  finishStructural(st, seq)
  stayNightsLine(st, acc, before)
  cabLine(st, added, removed, addedDates)
  return true
}

function removeStay(st, acc) {
  const n = nightsOf(acc)
  if (st.nights - n < 1) {
    st.warnings.push(`Can't remove ${hotelStay(acc)} — a trip needs at least 1 night`)
    return
  }
  const seq = staySequence(st)
  st.s.accommodations = st.s.accommodations.filter((a) => a !== acc)
  const removed = deleteRange(st, acc.checkIn, n)
  st.nights -= n
  finishStructural(st, seq)
  st.changes.push(`Removed ${hotelStay(acc)} stay (${acc.name || 'hotel'}, ${plural(n, 'night')})`)
  cabLine(st, 0, removed)
}

/** Catalog hotel -> accommodation, priced exactly like buildTrip.js's stayAccommodation. */
function pricedStay(st, hotel, checkIn, nights, neighbour) {
  const roomType = hotelRoomTypes(hotel)[0] || 'Deluxe'
  const section = findRoomTypeSection(hotel, roomType, checkIn)
  const adults = Number(st.s.tripInfo.adults) || 1
  return {
    id: newId(),
    hotelId: hotel.id,
    name: hotel.name,
    city: hotel.city,
    category: hotelCategoryLabel(hotel.category) || '4 Star',
    roomType,
    rooms: String(Math.max(1, Math.ceil(adults / 2))),
    cnbCount: String(Number(st.s.tripInfo.kids5to12) || 0),
    extraBeds5To12Count: '0',
    extraBedsAbove12Count: '0',
    extraAdultCount: '0',
    mealPlan: neighbour?.mealPlan || '',
    pricePerRoom: section.price || 0,
    bedPrices: bedPricesFromSection(section),
    photo: hotel.image_url || hotel.image_path || null,
    checkIn,
    checkOut: addDays(checkIn, nights),
    cancelled: false,
    cancelledAt: null,
    cancellationCharge: '',
    cancellationNote: '',
    alternateOptions: [],
    markupPercentage: '',
  }
}

function guestText(a, c, i) {
  let t = plural(a, 'adult')
  if (c) t += `, ${c} ${c === 1 ? 'child' : 'children'}`
  if (i) t += `, ${plural(i, 'infant')}`
  return t
}

function makeLeisure(day, n, city) {
  day.title = city ? `Day ${n}: Leisure Day in ${city}` : `Day ${n}: Leisure Day`
  setLines(day, [LEISURE_LINE])
}

const isLeisureOnly = (lines) => lines.length === 1 && sameName(lines[0], LEISURE_LINE)
const withoutLeisure = (lines) => lines.filter((l) => !sameName(l, LEISURE_LINE))

/* ───────────────────────────── actions ───────────────────────────── */

const HANDLERS = {
  /** Reorder the hotels into the shortest road loop (route.js), moving each stay's days, cabs and activities with it. */
  SORT_STAYS(st, a) {
    if (!needDates(st)) return
    const stays = getStays(st.s.accommodations)
    if (stays.length < 2) return st.warnings.push('There is only one hotel — nothing to sort')
    const start = st.s.tripInfo.startDate
    const backToBack = stays.every((acc, i) => nightsOf(acc) >= 1 && acc.checkIn === (i ? stays[i - 1].checkOut : start))
    if (!backToBack) return st.warnings.push("The hotels aren't back to back from the start date, so they can't be reordered automatically")

    const cities = stays.map((acc) => ({ city: acc.city }))
    let r
    if (Array.isArray(a.sequence) && a.sequence.length) {
      // An order the agent spelled out: those cities first, in that order; the rest after, as they were.
      const rank = (acc) => {
        const i = a.sequence.findIndex((c) => sameName(c, acc.city))
        return i < 0 ? a.sequence.length : i
      }
      const order = stays.map((acc, i) => i).sort((x, y) => rank(stays[x]) - rank(stays[y]) || x - y)
      const km = bestStayOrder(order.map((i) => cities[i]), { hotels: st.catalog.hotels || [] })
      r = { ok: true, order, changed: order.some((v, i) => v !== i), km: km.spokenKm, spokenKm: km.spokenKm, path: [...new Set(order.map((i) => stays[i].city))], unknown: [] }
    } else {
      r = bestStayOrder(cities, { hotels: st.catalog.hotels || [], first: a.first || '' })
    }
    if (!r.ok) {
      const where = r.unknown.length ? `where ${r.unknown.join(', ')} ${r.unknown.length === 1 ? 'is' : 'are'}` : 'the roads between these cities'
      return st.warnings.push(`Can't sort by route: I don't know ${where} — add a map location to that hotel`)
    }
    const path = r.path.join(' → ')
    if (!r.changed) return st.changes.push(a.sequence ? `Route: already ${path}` : `Route: already the best order — ${path} (~${r.km} km)`)

    const seq = staySequence(st)
    const before = stays.map((acc) => acc.city).filter((c, i, arr) => !i || !sameName(c, arr[i - 1])).join(' → ')
    // Old day → new day: each stay's nights move as a block; the departure day stays last.
    const move = new Map()
    let cursor = 1
    const order = r.order.map((i) => stays[i])
    for (const acc of order) {
      const d0 = dayOfDate(st, acc.checkIn)
      const n = nightsOf(acc)
      for (let j = 0; j < n; j += 1) move.set(d0 + j, cursor + j)
      cursor += n
    }
    const to = (d) => move.get(d) ?? d
    const days = st.s.itinerary
    if (days.length >= cursor - 1) {
      const next = new Array(days.length)
      days.forEach((day, i) => {
        next[to(i + 1) - 1] = day
      })
      st.s.itinerary = next
    } else {
      st.warnings.push('The day plan is shorter than the hotel nights — check the day order')
    }
    // Cancelled bookings inside a stay's dates move with that stay.
    const tagAlong = st.s.accommodations
      .filter((x) => isCancelled(x) && x.checkIn)
      .map((x) => ({ x, owner: stays.find((acc) => acc.checkIn <= x.checkIn && x.checkIn < acc.checkOut), was: x.checkIn }))
      .filter((t) => t.owner)
      .map((t) => ({ ...t, ownerWas: t.owner.checkIn }))
    order.reduce((checkIn, acc) => {
      const n = nightsOf(acc)
      acc.checkIn = checkIn
      acc.checkOut = addDays(checkIn, n)
      return acc.checkOut
    }, start)
    for (const { x, owner, ownerWas } of tagAlong) {
      const shift = diffDays(ownerWas, owner.checkIn)
      const n = nightsOf(x)
      x.checkIn = addDays(x.checkIn, shift)
      if (Number.isFinite(n)) x.checkOut = addDays(x.checkIn, n)
    }
    st.s.accommodations = [...order, ...st.s.accommodations.filter((acc) => !order.includes(acc))]
    for (const t of st.s.transportation) {
      if (t.date && !isFullTripCab(t)) t.date = dateOfDay(st, to(dayOfDate(st, t.date)))
    }
    st.s.transportation = st.s.transportation
      .map((t, i) => ({ t, i }))
      .sort((x, y) => String(x.t.date || '').localeCompare(String(y.t.date || '')) || x.i - y.i)
      .map(({ t }) => t)
    for (const act of st.s.tripActivities) {
      const n = toInt(act.dayNumber)
      if (Number.isInteger(n) && n >= 1) act.dayNumber = typeof act.dayNumber === 'string' ? String(to(n)) : to(n)
    }
    finishStructural(st, seq)
    const saved = r.spokenKm - r.km
    const km = r.km ? ` (~${r.km} km${saved > 0 ? `, ~${saved} km shorter` : ''})` : ''
    st.changes.push(`Route: ${before} ⇒ ${path}${km}`)
  },

  SET_STAY_NIGHTS(st, a) {
    const acc = stayAt(st, a.stay)
    if (!acc) return
    const nights = toInt(a.nights)
    if (!(nights >= 0)) return st.warnings.push(`"${a.nights}" is not a number of nights`)
    if (!needDates(st, acc)) return
    st.explicit.add(acc)
    if (nights === 0) return removeStay(st, acc)
    changeStayNights(st, acc, nights - nightsOf(acc))
  },

  REMOVE_STAY(st, a) {
    const acc = stayAt(st, a.stay)
    if (!acc || !needDates(st, acc)) return
    removeStay(st, acc)
  },

  ADD_STAY(st, a) {
    const nights = toInt(a.nights)
    if (!(nights >= 1)) return st.warnings.push('Say how many nights the new stay is')
    if (!needDates(st)) return
    let hotel = findById(st.catalog.hotels, a.hotelId)
    if (a.hotelId != null && !hotel) st.warnings.push(`Hotel #${a.hotelId} is not in your hotel list`)
    if (!hotel && a.hotelId == null && !String(a.hotelName || '').trim() && String(a.city || '').trim()) {
      // Only a city was said: suggest the agency's best match there (same stars as the trip, cheapest).
      const stars = getStays(st.s.accommodations).map((x) => parseInt(x.category, 10)).filter(Boolean)
      const date = normDate(st.s.tripInfo.startDate) ? addDays(st.s.tripInfo.startDate, st.nights) : ''
      hotel = rankHotelsForCity(a.city, st.catalog.hotels || [], { category: stars[0] ?? null, date })[0] || null
      if (hotel) st.picked.push(a.city)
    }
    const city = hotel?.city || String(a.city || '').trim()
    const name = hotel?.name || String(a.hotelName || '').trim()
    if (!city) return st.warnings.push(`Which city is ${name || 'the new hotel'} in? Stay not added`)

    let neighbour = null
    let pivot
    const after = a.after == null ? null : toInt(a.after)
    if (after === -1) {
      pivot = st.s.tripInfo.startDate
      neighbour = getStays(st.s.accommodations)[0] || null
    } else if (after != null) {
      neighbour = stayAt(st, after)
      if (!neighbour || !needDates(st, neighbour)) return
      pivot = neighbour.checkOut
    } else {
      const stays = getStays(st.s.accommodations).filter((x) => nightsOf(x) >= 0)
      neighbour = stays[stays.length - 1] || null
      pivot = neighbour ? neighbour.checkOut : addDays(st.s.tripInfo.startDate, st.nights)
    }

    const seq = staySequence(st)
    const cab = (neighbour && blockCab(st, neighbour)) || anyDayCab(st)
    addKnown(st, city)
    const added = insertDays(st, pivot, nights, city, { cab })
    const acc = hotel
      ? pricedStay(st, hotel, pivot, nights, neighbour)
      : {
          ...pricedStay(st, { id: null, name, city }, pivot, nights, neighbour),
          category: '',
          pricePerRoom: 0,
          bedPrices: [],
        }
    if (!hotel) st.warnings.push(`${name || 'The new hotel'} is not in your hotel list — price not set`)
    else if (hotel.is_available === false) st.warnings.push(`${hotel.name} is marked unavailable`)
    const at = neighbour && after !== -1 ? st.s.accommodations.indexOf(neighbour) + 1 : st.s.accommodations.length
    st.s.accommodations.splice(after === -1 ? 0 : at, 0, acc)
    st.nights += nights
    finishStructural(st, seq)
    const price = acc.pricePerRoom ? `, ${money(acc.pricePerRoom)}/room/night` : ''
    st.changes.push(
      `Added ${city} stay: ${name || 'hotel'}, ${plural(nights, 'night')} (${fmtRange(acc.checkIn, acc.checkOut)}${price})`,
    )
    const dates = Array.from({ length: added }, (_, j) => addDays(pivot, j))
    cabLine(st, added, 0, dates)
  },

  REPLACE_HOTEL(st, a) {
    const acc = stayAt(st, a.stay)
    if (!acc) return
    const hotel = findById(st.catalog.hotels, a.hotelId) || (a.hotelId == null ? findByName(st.catalog.hotels, a.hotelName) : null)
    if (!hotel) return st.warnings.push(`${a.hotelName || `Hotel #${a.hotelId}`} is not in your hotel list — hotel not changed`)
    if (String(hotel.id) === String(acc.hotelId)) return
    const oldName = acc.name || 'hotel'
    const oldCity = acc.city || ''
    const types = hotelRoomTypes(hotel)
    const roomType = types.find((t) => toRoomTypeSlug(t) === toRoomTypeSlug(acc.roomType)) || types[0] || acc.roomType || 'Deluxe'
    const section = findRoomTypeSection(hotel, roomType, acc.checkIn)
    const seq = staySequence(st)
    Object.assign(acc, {
      hotelId: hotel.id,
      name: hotel.name,
      city: hotel.city || acc.city,
      category: hotelCategoryLabel(hotel.category) || acc.category,
      roomType,
      pricePerRoom: section.price || 0,
      bedPrices: bedPricesFromSection(section),
      photo: hotel.image_url || hotel.image_path || null,
    })
    const price = section.price ? ` (${money(section.price)}/room/night)` : ''
    st.changes.push(`${oldCity || acc.city} hotel: ${oldName} → ${hotel.name}${price}`)
    if (!section.price) st.warnings.push(`${hotel.name} has no rate for these dates — price not set`)
    if (hotel.is_available === false) st.warnings.push(`${hotel.name} is marked unavailable`)
    if (oldCity && acc.city && !sameName(oldCity, acc.city)) {
      addKnown(st, acc.city)
      finishStructural(st, seq)
      st.warnings.push(`${hotel.name} is in ${acc.city}, not ${oldCity} — day titles updated to match`)
    }
  },

  SET_TRIP_NIGHTS(st, a) {
    const target = toInt(a.nights)
    if (!(target >= 1)) return st.warnings.push('A trip needs at least 1 night')
    if (!needDates(st)) return
    const delta = target - st.nights
    if (!delta) return
    const stays = getStays(st.s.accommodations).filter((x) => nightsOf(x) >= 1)
    if (!stays.length) {
      // No hotels: grow/shrink the day plan before the departure day.
      const seq = staySequence(st)
      let added = 0
      let removed = 0
      if (delta > 0) {
        const days = st.s.itinerary
        const city = days[days.length - 2]?.location || days[0]?.location || st.s.tripInfo.destination || ''
        added = insertDays(st, addDays(st.s.tripInfo.startDate, st.nights), delta, city, { cab: anyDayCab(st) })
      } else {
        removed = deleteRange(st, addDays(st.s.tripInfo.startDate, st.nights + delta), -delta)
      }
      st.nights += delta
      finishStructural(st, seq)
      cabLine(st, added, removed)
      return
    }
    const reversed = [...stays].reverse()
    const free = reversed.filter((x) => !st.explicit.has(x))
    const pool = free.length ? free : [reversed[0]]
    if (delta > 0) {
      changeStayNights(st, pool[0], delta)
      return
    }
    let need = -delta
    const plan = []
    for (const acc of pool) {
      const take = Math.min(need, nightsOf(acc) - 1)
      if (take > 0) {
        plan.push([acc, take])
        need -= take
      }
      if (!need) break
    }
    if (need) {
      return st.warnings.push(
        `Can't cut the trip to ${plural(target, 'night')} without dropping a hotel — remove a stay first`,
      )
    }
    plan.forEach(([acc, take]) => changeStayNights(st, acc, -take))
  },

  SET_START_DATE(st, a) {
    const date = normDate(a.date)
    if (!date) return st.warnings.push(`"${a.date}" is not a valid date`)
    const ti = st.s.tripInfo
    const old = normDate(ti.startDate)
    if (old === date) return
    ti.startDate = date
    if (!old) {
      st.changes.push(`Start date: ${fmtDay(date, true)}`)
      return
    }
    const delta = diffDays(old, date)
    for (const acc of st.s.accommodations) {
      if (normDate(acc.checkIn)) acc.checkIn = addDays(acc.checkIn, delta)
      if (normDate(acc.checkOut)) acc.checkOut = addDays(acc.checkOut, delta)
    }
    for (const t of st.s.transportation) if (normDate(t.date)) t.date = addDays(t.date, delta)
    st.changes.push(
      `Start date: ${fmtDay(old, true)} → ${fmtDay(date, true)} (now ${fmtRange(date, addDays(date, st.nights), true)})`,
    )
  },

  SET_GUESTS(st, a) {
    const ti = st.s.tripInfo
    const old = { a: Number(ti.adults) || 0, c: Number(ti.kids5to12) || 0, i: Number(ti.kidsUpto5) || 0 }
    const pick = (v, fallback) => (v == null || v === '' ? fallback : toInt(v))
    const next = { a: pick(a.adults, old.a), c: pick(a.children, old.c), i: pick(a.infants, old.i) }
    if (!(next.a >= 1)) return st.warnings.push('A trip needs at least 1 adult')
    if (!(next.c >= 0) || !(next.i >= 0)) return st.warnings.push('Guest counts must be whole numbers')
    if (next.a === old.a && next.c === old.c && next.i === old.i) return
    ti.adults = next.a
    ti.kids5to12 = next.c
    ti.kidsUpto5 = next.i
    st.changes.push(`Guests: ${guestText(old.a, old.c, old.i)} → ${guestText(next.a, next.c, next.i)}`)

    const stays = getStays(st.s.accommodations)
    if (next.a !== old.a && !st.hasSetRooms) {
      const rooms = String(Math.max(1, Math.ceil(next.a / 2)))
      let n = 0
      stays.forEach((acc) => {
        if (String(acc.rooms) !== rooms) {
          acc.rooms = rooms
          n += 1
        }
      })
      if (n) st.changes.push(`Rooms: ${rooms} in ${n === stays.length ? 'every hotel' : plural(n, 'hotel')}`)
    }
    if (next.c !== old.c) {
      let n = 0
      stays.forEach((acc) => {
        if (String(acc.cnbCount ?? '0') !== String(next.c)) {
          acc.cnbCount = String(next.c)
          n += 1
        }
      })
      if (n) st.changes.push(`Child-no-bed: ${next.c} in ${n === stays.length ? 'every hotel' : plural(n, 'hotel')}`)
    }
    const oldCount = old.a + old.c
    const newCount = next.a + next.c
    if (oldCount !== newCount) {
      st.s.tripActivities.forEach((act) => {
        if (Number(act.ticketCount) === oldCount) {
          act.ticketCount = typeof act.ticketCount === 'number' ? newCount : String(newCount)
          st.changes.push(`${act.name || 'Activity'}: ${oldCount} → ${plural(newCount, 'ticket')}`)
        }
      })
    }
  },

  SET_ROOMS(st, a) {
    const rooms = toInt(a.rooms)
    if (!(rooms >= 1)) return st.warnings.push('Rooms must be at least 1')
    if (a.stay === 'all') {
      const stays = getStays(st.s.accommodations)
      if (!stays.length) return st.warnings.push('There are no hotels on this trip')
      let n = 0
      stays.forEach((acc) => {
        if (String(acc.rooms) !== String(rooms)) {
          acc.rooms = String(rooms)
          n += 1
        }
      })
      if (n) st.changes.push(`Rooms: ${rooms} in ${n === stays.length ? 'every hotel' : plural(n, 'hotel')}`)
      return
    }
    const acc = stayAt(st, a.stay)
    if (!acc || String(acc.rooms) === String(rooms)) return
    st.changes.push(`${hotelStay(acc)} rooms: ${acc.rooms || 1} → ${rooms}`)
    acc.rooms = String(rooms)
  },

  SET_MEAL_PLAN(st, a) {
    const plan = MEAL_PLANS.find((p) => sameName(p, a.mealPlan))
    if (!plan) return st.warnings.push(`"${a.mealPlan}" is not a meal plan (${MEAL_PLANS.join(' / ')})`)
    if (a.stay === 'all') {
      const stays = getStays(st.s.accommodations)
      if (!stays.length) return st.warnings.push('There are no hotels on this trip')
      const changed = stays.filter((acc) => acc.mealPlan !== plan)
      changed.forEach((acc) => {
        acc.mealPlan = plan
      })
      if (changed.length) {
        st.changes.push(`Meal plan: ${plan} in ${changed.length === stays.length ? 'every hotel' : plural(changed.length, 'hotel')}`)
      }
      return
    }
    const acc = stayAt(st, a.stay)
    if (!acc || acc.mealPlan === plan) return
    st.changes.push(`${hotelStay(acc)} meal plan: ${acc.mealPlan || 'not set'} → ${plan}`)
    acc.mealPlan = plan
  },

  SET_VEHICLE(st, a) {
    const vehicles = st.catalog.vehicles || []
    const v = findById(vehicles, a.vehicleId) || (a.vehicleId == null ? findByName(vehicles, a.vehicleName) : null)
    if (!v) return st.warnings.push(`${a.vehicleName || `Vehicle #${a.vehicleId}`} is not in your vehicle list`)
    const cabs = st.s.transportation
    if (cabs.length) {
      const changed = cabs.filter((t) => String(t.vehicleId) !== String(v.id) || t.vehicleType !== v.name)
      if (!changed.length) return
      const oldName = mostCommonVehicle(cabs)?.name || 'cab'
      cabs.forEach((t) => {
        t.vehicleId = v.id
        t.vehicleType = v.name
      })
      st.changes.push(`Vehicle: ${oldName} → ${v.name} (${plural(cabs.length, 'booking')})`)
      if (v.rate_type === 'per_trip' && cabs.length > 1) {
        st.warnings.push(`${v.name} is priced per trip but there are ${cabs.length} cab bookings, each charged — check the Transport tab`)
      } else if (v.rate_type !== 'per_trip' && cabs.length === 1 && isFullTripCab(cabs[0]) && st.nights > 0) {
        st.warnings.push(`${v.name} is priced per day but the trip has one full-trip booking — check the Transport tab`)
      }
      return
    }
    if (!needDates(st)) return
    const days = st.s.itinerary
    const entry = (n, tripType, route, destination) => ({
      id: newId(),
      vehicleId: v.id,
      tripType,
      route,
      destination,
      date: dateOfDay(st, n),
      vehicleType: v.name,
      quantity: 1,
      remarks: '',
      markupPercentage: '',
    })
    if (v.rate_type === 'per_trip') {
      const seq = staySequence(st)
      const cities = seq.length ? seq : [...new Set(days.map((d) => d.location).filter(Boolean))]
      cabs.push(entry(1, 'Transfer', `Full trip: ${cities.join(' → ')}`, cities[0] || days[0]?.location || ''))
      st.changes.push(`Vehicle: ${v.name} added (1 full-trip booking)`)
      return
    }
    if (!days.length) return st.warnings.push('The trip has no day plan to book cabs against')
    days.forEach((day, i) => {
      const route = routeOf(stripDayPrefix(day.title))
      cabs.push(entry(i + 1, /Sightseeing/.test(route) ? 'Sightseeing' : 'Transfer', route, day.location || ''))
    })
    st.changes.push(`Vehicle: ${v.name} added (${plural(days.length, 'per-day booking')})`)
  },

  REMOVE_VEHICLE(st) {
    const n = st.s.transportation.length
    if (!n) return st.warnings.push('There are no cab bookings to remove')
    st.s.transportation = []
    st.changes.push(`Cabs: all ${plural(n, 'booking')} removed`)
  },

  SET_MARGIN(st, a) {
    const pct = a.percent == null ? Number(st.settings.profit_percentage) : Number(a.percent)
    if (!Number.isFinite(pct) || pct < 0) return st.warnings.push(`"${a.percent}" is not a valid margin`)
    const old = Number(st.s.profitMarginPercentage) || 0
    if (pct > 100) st.warnings.push(`Margin of ${pct}% is unusually high — double-check it`)
    if (pct === old) return
    st.s.profitMarginPercentage = pct
    st.changes.push(`Margin: ${old}% → ${pct}%`)
  },

  SET_GST(st, a) {
    const s = st.s
    const oldInclude = s.includeGST !== false
    const oldPct = Number(s.gstPercentage) || 0
    const include = typeof a.include === 'boolean' ? a.include : oldInclude
    let pct = oldPct
    if (a.percent != null && a.percent !== '') pct = Number(a.percent)
    else if (include && !oldPct) pct = Number(st.settings.gst_percentage) || 0
    if (!Number.isFinite(pct) || pct < 0) return st.warnings.push(`"${a.percent}" is not a valid GST rate`)
    if (include === oldInclude && pct === oldPct) return
    s.includeGST = include
    s.gstPercentage = pct
    if (!include) st.changes.push(oldInclude ? `GST: removed (was ${oldPct}%)` : `GST rate: ${oldPct}% → ${pct}% (GST is off)`)
    else if (!oldInclude) st.changes.push(`GST: added at ${pct}%`)
    else st.changes.push(`GST: ${oldPct}% → ${pct}%`)
    if (include && !pct) st.warnings.push('GST is on but the rate is 0%')
  },

  SET_CLIENT(st, a) {
    const ti = st.s.tripInfo
    const fields = [
      ['clientName', 'Client name'],
      ['clientPhone', 'Client phone'],
      ['clientEmail', 'Client email'],
    ]
    for (const [key, label] of fields) {
      if (a[key] == null) continue
      const value = String(a[key]).trim()
      const old = String(ti[key] || '')
      if (value === old) continue
      if (key === 'clientEmail' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        st.warnings.push(`"${value}" doesn't look like an email address`)
      }
      ti[key] = value
      st.changes.push(old ? `${label}: ${old} → ${value || '(blank)'}` : `${label}: ${value}`)
    }
  },

  ADD_ACTIVITY(st, a) {
    const list = st.catalog.activities || []
    let cat = findById(list, a.activityId)
    if (a.activityId != null && !cat) st.warnings.push(`Activity #${a.activityId} is not in your activity list`)
    if (!cat && a.activityId == null && a.name) cat = list.find((x) => sameName(x.name, a.name)) || null
    const name = cat?.name || String(a.name || '').trim()
    if (!name) return st.warnings.push('Which activity should be added?')

    let dayNumber = ''
    let dayObj = null
    if (a.day != null && a.day !== '') {
      const r = dayAt(st, a.day)
      if (r) {
        dayNumber = r.n
        dayObj = r.day
      }
    }
    const destName = cat ? findById(st.catalog.destinations, cat.destination_id)?.name || '' : ''
    const location = String(a.location || '').trim() || destName || dayObj?.location || st.s.tripInfo.destination || ''
    if (a.day == null && location) {
      const i = st.s.itinerary.findIndex((d) => sameName(d.location, location))
      if (i >= 0) dayNumber = i + 1
    }
    if (dayObj && location && dayObj.location && !sameName(dayObj.location, location)) {
      st.warnings.push(`${name} is in ${location} but day ${dayNumber} is in ${dayObj.location}`)
    }
    if (st.s.tripActivities.some((x) => sameName(x.name, name) && String(x.dayNumber) === String(dayNumber))) {
      return st.warnings.push(`${name} is already on ${dayNumber ? `day ${dayNumber}` : 'the trip'}`)
    }
    const persons = toInt(a.persons) >= 1 ? toInt(a.persons) : Math.max(1, guestCount(st.s))
    const rawPrice = a.pricePerTicket ?? cat?.selling_price ?? null
    const price = rawPrice == null || rawPrice === '' ? null : Number(rawPrice)
    st.s.tripActivities.push({
      id: newId(),
      activityId: cat?.id ?? null,
      name,
      location,
      dayNumber,
      ticketCount: String(persons),
      pricePerTicket: price == null ? '' : price,
      markupPercentage: '',
      notes: '',
    })
    const cost = price == null ? `${plural(persons, 'person')}, price not set` : `${persons} × ${money(price)}`
    st.changes.push(`Added ${name}${dayNumber ? ` on day ${dayNumber}` : ''} (${cost})`)
    if (price == null) st.warnings.push(`${name}: ticket price not set`)
    if (!dayNumber) st.warnings.push(`${name} isn't on a day yet — pick one in the Activities tab`)
  },

  REMOVE_ACTIVITY(st, a) {
    const i = toInt(a.index)
    const act = Number.isInteger(i) && i >= 0 ? st.origActs[i] : null
    if (!act) return st.warnings.push(`There is no activity #${Number.isInteger(i) ? i + 1 : a.index}`)
    if (!st.s.tripActivities.includes(act)) return st.warnings.push(`${act.name || 'That activity'} was already removed`)
    st.s.tripActivities = st.s.tripActivities.filter((x) => x !== act)
    const day = act.dayNumber === '' || act.dayNumber == null ? '' : ` from day ${act.dayNumber}`
    st.changes.push(`Removed ${act.name || 'activity'}${day}`)
  },

  SET_DAY_LEISURE(st, a) {
    const r = dayAt(st, a.day)
    if (!r) return
    const { day, n } = r
    const city = cityOfDay(st, day, n)
    const lines = dayLines(day)
    const rest = stripDayPrefix(day.title)
    if (/^Leisure Day\b/i.test(rest) && isLeisureOnly(lines)) return
    if (isAutoTitle(st, rest) && !/Sightseeing$/i.test(rest)) {
      st.warnings.push(`Day ${n} was a travel day (${rest}) — it is now titled as a leisure day`)
    }
    makeLeisure(day, n, city)
    const date = dateOfDay(st, n)
    const cab = st.s.transportation.find((t) => t.date === date && t.tripType === 'Sightseeing')
    if (cab) st.warnings.push(`Day ${n} still has a sightseeing cab booked (${cab.route || cab.vehicleType})`)
    st.changes.push(`Day ${n} is now a leisure day`)
  },

  CLEAR_DAY_SIGHTSEEING(st, a) {
    const r = dayAt(st, a.day)
    if (!r) return
    if (!dayLines(r.day).length) return
    setLines(r.day, [])
    st.changes.push(`Day ${r.n}: sightseeing removed`)
  },

  MOVE_DAY_PLAN(st, a) {
    const from = dayAt(st, a.fromDay)
    const to = dayAt(st, a.toDay)
    if (!from || !to) return
    if (from.day === to.day) return st.warnings.push('Both days are the same — nothing to move')
    const moving = withoutLeisure(dayLines(from.day))
    if (!moving.length) return st.warnings.push(`Day ${from.n} has no plan to move`)
    const target = withoutLeisure(dayLines(to.day))
    const merged = [...target, ...moving.filter((l) => !target.some((t) => sameName(t, l)))]
    setLines(to.day, merged)
    const fromCity = cityOfDay(st, from.day, from.n)
    const toCity = cityOfDay(st, to.day, to.n)
    if (fromCity && toCity && !sameName(fromCity, toCity)) {
      st.warnings.push(`Day ${from.n} is in ${fromCity} but day ${to.n} is in ${toCity} — check the moved plan`)
    }
    makeLeisure(from.day, from.n, fromCity)
    let movedActs = 0
    st.s.tripActivities.forEach((act) => {
      if (act.dayNumber !== '' && act.dayNumber != null && Number(act.dayNumber) === from.n) {
        act.dayNumber = typeof act.dayNumber === 'string' ? String(to.n) : to.n
        movedActs += 1
      }
    })
    const extra = movedActs ? ` (with ${plural(movedActs, 'activity')})` : ''
    st.changes.push(`Day ${from.n} plan moved to day ${to.n}${extra}; day ${from.n} is now a leisure day`)
  },

  ADD_DAY_ITEM(st, a) {
    const r = dayAt(st, a.day)
    if (!r) return
    const text = String(a.text || '').trim()
    if (!text) return st.warnings.push(`What should be added to day ${r.n}?`)
    const lines = withoutLeisure(dayLines(r.day))
    if (lines.some((l) => sameName(l, text))) return st.warnings.push(`"${text}" is already on day ${r.n}`)
    setLines(r.day, [...lines, text])
    st.changes.push(`Day ${r.n}: added "${text}"`)
  },
}

/* ───────────────────────────── entry point ───────────────────────────── */

/**
 * Apply edit actions in order (each sees the previous result).
 * @returns {{ snapshot, changes: string[], warnings: string[] }}
 */
export function applyEditActions(snapshot, actions, { catalog = {}, settings = {} } = {}) {
  const s = prepare(snapshot)
  const list = Array.isArray(actions) ? actions : []
  const st = {
    s,
    catalog: catalog || {},
    settings: settings || {},
    changes: [],
    warnings: [],
    known: new Set(),
    nights: totalNights(s),
    origStays: getStays(s.accommodations),
    origDays: [...s.itinerary],
    origActs: [...s.tripActivities],
    picked: [],
    explicit: new Set(),
    hasSetRooms: list.some((a) => a?.type === 'SET_ROOMS'),
  }
  ;[
    ...s.accommodations.map((a) => a.city),
    ...s.itinerary.map((d) => d.location),
    ...(st.catalog.hotels || []).map((h) => h.city),
    ...(st.catalog.destinations || []).map((d) => d.name),
  ].forEach((name) => addKnown(st, name))

  const startNights = st.nights
  for (const action of list) {
    const type = action?.type
    if (COMMANDS.has(type)) continue
    const handler = HANDLERS[type]
    if (!handler) {
      st.warnings.push(`Don't know how to do "${type || 'that'}"`)
      continue
    }
    const checkIns = new Map(
      st.s.accommodations.filter((acc) => !isCancelled(acc)).map((acc) => [acc, acc.checkIn]),
    )
    try {
      handler(st, action)
    } catch (err) {
      st.warnings.push(`Couldn't apply ${type}: ${err?.message || err}`)
    }
    for (const [acc, before] of checkIns) {
      if (st.s.accommodations.includes(acc) && before && acc.checkIn !== before) repriceForDates(st, acc, before)
    }
  }

  if (st.nights !== startNights) {
    const ti = s.tripInfo
    ti.duration = String(st.nights)
    if (typeof ti.tripTitle === 'string') {
      ti.tripTitle = ti.tripTitle.replace(/\b\d+\s*N\s*\/\s*\d+\s*D\b/i, `${st.nights}N/${st.nights + 1}D`)
    }
    const start = normDate(ti.startDate)
    const when = start ? `, now ${fmtRange(start, addDays(start, st.nights), true)}` : ''
    st.changes.push(`Trip: ${startNights} → ${plural(st.nights, 'night')}${when}`)
  }

  return { snapshot: s, changes: st.changes, warnings: st.warnings, picked: st.picked }
}
