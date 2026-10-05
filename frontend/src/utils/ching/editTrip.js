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
  findRateSection,
  MEAL_PLAN_LABEL,
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
  findDestination,
  cityLines,
  MEAL_PLANS,
} from './editTripUtil.js'
import {
  dateOfDay,
  isFullTripCab,
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
import { formatPhone, prepareCatalog, cityLookup } from './parseCommand.js'
import { buildDayPlan } from './dayPlan.js'
import { samePlace } from './places.js'
import { pickHotel, pickVehicle, isRoadCab } from './buildTrip.js'
import { dayWiseCabs, repriceCabs, isIncludedCab, keepPerTripPriced, routeForDay, plainDestinationDay } from './cabPlan.js'
import { applyInclusion } from './inclusions.js'
import { activityRateOptions, findActivityRate, dateForDay } from '../activityRates.js'
import { marginForTotal, marginForProfit } from './pricing.js'

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
      rooms: parseInt(a.rooms, 10) || 1,
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

const hotelStay = (acc) => `${acc.city || acc.name || 'Hotel'}`

// A stay's hotel replaced as REPLACE_HOTEL does it (room type / meal plan said kept).
function swapInto(st, acc, hotel, a = {}) {
  if (String(acc.hotelId) === String(hotel.id)) return st.warnings.push(`${acc.city || 'That stay'} is already at ${hotel.name}`)
  const mealPlan = MEAL_PLAN_LABEL[a.mealPlan] ? a.mealPlan : Object.keys(MEAL_PLAN_LABEL).find((k) => MEAL_PLAN_LABEL[k] === a.mealPlan)
  return HANDLERS.REPLACE_HOTEL(st, { stay: st.origStays.indexOf(acc), hotelId: hotel.id, hotelName: hotel.name, city: hotel.city || acc.city, roomType: a.roomType, mealPlan })
}

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
// The whole hotel form, as the Add Hotel modal fills it: room type, rooms,
// children, meal plan, the rate for that room + meal plan + date, extra-bed
// prices and photo. `opts` carries what was said ({ roomType, rooms,
// mealPlan, extraBeds }); otherwise the stay next to it, then the rate sheet.
// Days ready for cab rows: a day that is only its destination ("Day 2:
// Gulmarg", added from the Itinerary picker) gets its route worked out from
// the hotel nights around it (cabPlan.routeForDay) — Arrival, Sightseeing,
// "Srinagar → Gulmarg → Srinagar" day trip, "Srinagar → Gulmarg" move.
function routedDays(st, subset) {
  const all = sortDays(st.s.itinerary)
  const start = st.s.tripInfo.startDate
  const nightCity = (i) => {
    const date = addDays(start, i)
    const acc = st.s.accommodations.find((x) => !isCancelled(x) && x.checkIn <= date && x.checkOut > date)
    return acc?.city || ''
  }
  return subset.map((d) => {
    if (d.route || !plainDestinationDay(d)) return d
    const i = all.indexOf(d)
    return i < 0 ? d : { ...d, ...routeForDay(all, i, nightCity) }
  })
}

// The itinerary city of the night that starts on `date`.
function nightCity(st, date) {
  const k = diffDays(st.s.tripInfo.startDate, date)
  return k >= 0 ? sortDays(st.s.itinerary)[k]?.location || '' : ''
}

// Nights of the trip with no hotel yet, as runs of consecutive nights in one
// itinerary city: [{ start, nights, city }]. Night k sleeps in day k's city.
function openNightRuns(st) {
  const start = st.s.tripInfo.startDate
  const total = st.nights
  if (!start || !(total > 0)) return []
  const covered = new Set()
  for (const acc of st.s.accommodations) {
    if (isCancelled(acc) || !acc.checkIn || !acc.checkOut) continue
    for (let d = acc.checkIn; d < acc.checkOut; d = addDays(d, 1)) covered.add(d)
  }
  const days = sortDays(st.s.itinerary)
  const runs = []
  for (let k = 0; k < total; k++) {
    const date = addDays(start, k)
    if (covered.has(date)) continue
    const city = days[k]?.location || ''
    const last = runs[runs.length - 1]
    if (last && addDays(last.start, last.nights) === date && (samePlace(last.city, city) || (!last.city && !city))) last.nights += 1
    else runs.push({ start: date, nights: 1, city })
  }
  return runs
}

function pricedStay(st, hotel, checkIn, nights, neighbour, opts = {}) {
  const types = hotelRoomTypes(hotel)
  const said = opts.roomType ? types.find((t) => toRoomTypeSlug(t) === toRoomTypeSlug(opts.roomType)) : null
  const roomType = said || types[0] || 'Deluxe'
  const mealSaid = opts.mealPlan || neighbour?.mealPlan || ''
  const usual = st.catalog.memory?.mealPlan || ''
  const mealKey = Object.keys(MEAL_PLAN_LABEL).find((k) => MEAL_PLAN_LABEL[k] === mealSaid) || ''
  const rated = mealKey ? findRateSection(hotel, roomType, checkIn, mealKey) : {}
  const section = rated.price ? rated : findRoomTypeSection(hotel, roomType, checkIn)
  // No meal plan said: the plan of the rate row the price came from.
  const mealPlan = mealSaid || (section.meal_plan ? MEAL_PLAN_LABEL[section.meal_plan] || '' : '') || usual
  const adults = Number(st.s.tripInfo.adults) || 1
  const rooms = opts.rooms || neighbour?.rooms || Math.max(1, Math.ceil(adults / 2))
  return {
    id: newId(),
    hotelId: hotel.id,
    name: hotel.name,
    city: hotel.city,
    category: hotelCategoryLabel(hotel.category) || '4 Star',
    roomType,
    rooms: String(rooms),
    cnbCount: String(Number(st.s.tripInfo.kids5to12) || 0),
    extraBeds5To12Count: '0',
    extraBedsAbove12Count: String(opts.extraBeds || neighbour?.extraBedsAbove12Count || 0),
    extraAdultCount: '0',
    mealPlan,
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

  // The Add Hotel form by voice (parseEdit hAddHotel): hotel or city, nights /
  // dates / days, rooms, room type, meal plan, extra beds. The hotel goes into
  // nights the trip already plans but has no hotel for; a hotel only named by
  // city is picked from the agency's own list there.
  ADD_HOTEL(st, a) {
    if (!needDates(st)) return
    const start = st.s.tripInfo.startDate
    const runs = openNightRuns(st)
    let hotel = a.hotelId != null ? findById(st.catalog.hotels, a.hotelId) : null
    if (a.hotelId != null && !hotel) return st.warnings.push(`Hotel #${a.hotelId} is not in your hotel list`)
    const city = hotel?.city || a.city || ''
    // Where: exact dates, itinerary days, the open nights in that city, or all of them.
    const places = []
    if (a.checkIn || a.fromDay != null) {
      const from = a.checkIn || addDays(start, a.fromDay - 1)
      const nights = a.checkOut ? diffDays(from, a.checkOut) : a.nights || (a.toDay != null ? a.toDay - a.fromDay + 1 : 0)
      if (!(nights >= 1)) return st.warnings.push('How many nights is the stay?')
      places.push({ start: from, nights, city: city || nightCity(st, from) })
    } else if (city) {
      const run = runs.find((r) => r.city && samePlace(r.city, city)) || (runs.length === 1 ? runs[0] : null)
      if (!run) {
        // Every night there already has a hotel: "add khyber in gulmarg" /
        // "गुलमर्ग में खैबर कर दो" means that stay's hotel becomes this one.
        if (!a.nights && hotel) {
          const own = getStays(st.s.accommodations).find((x) => x.city && (samePlace(x.city, city) || sameName(x.city, city)))
          if (own) return swapInto(st, own, hotel, a)
        }
        // Every night already has a hotel (or none is in that city): the old
        // "add N nights at X" — a new stay that lengthens the trip.
        if (a.nights >= 1) return HANDLERS.ADD_STAY(st, { ...a, city, hotelName: hotel?.name || a.hotelName || '' })
        return st.warnings.push(runs.length ? `The open nights aren't in ${city} — say the dates or days` : 'Every night already has a hotel — say which stay to change')
      }
      places.push({ start: run.start, nights: Math.min(a.nights || run.nights, run.nights), city: run.city || city })
      if (a.nights > run.nights) st.warnings.push(`Only ${plural(run.nights, 'night')} in ${run.city || city} need a hotel — booked those`)
    } else {
      if (!runs.length) return st.warnings.push('Every night already has a hotel')
      places.push(...runs)
    }
    for (const p of places) {
      // The nights must be free.
      const taken = st.s.accommodations.find((x) => !isCancelled(x) && x.checkIn < addDays(p.start, p.nights) && x.checkOut > p.start)
      // "add khyber for day 3" when day 3 is already at another Gulmarg hotel: swap it.
      if (taken && hotel && taken.city && (samePlace(taken.city, hotel.city || '') || sameName(taken.city, hotel.city || ''))) {
        swapInto(st, taken, hotel, a)
        continue
      }
      if (taken) {
        st.warnings.push(`${fmtRange(p.start, addDays(p.start, p.nights))} already has ${taken.name || 'a hotel'} — change that stay instead`)
        continue
      }
      const h = hotel || (p.city ? pickHotel(p.city, st.catalog.hotels || [], {}, st.catalog.memory) : null)
      if (!h) {
        st.warnings.push(`No hotel in your list for ${p.city || 'those nights'} — pick one`)
        continue
      }
      if (h.is_available === false) st.warnings.push(`${h.name} is marked unavailable`)
      const prev = getStays(st.s.accommodations).filter((x) => x.checkOut <= p.start).pop() || null
      const acc = pricedStay(st, h, p.start, p.nights, prev, a)
      st.s.accommodations.push(acc)
      st.s.accommodations.sort((x, y) => String(x.checkIn || '').localeCompare(String(y.checkIn || '')))
      addKnown(st, h.city)
      const price = acc.pricePerRoom ? `, ${money(acc.pricePerRoom)}/room/night` : ''
      st.changes.push(`Added ${h.city} stay: ${h.name}, ${plural(p.nights, 'night')} (${fmtRange(acc.checkIn, acc.checkOut)}${price})${hotel ? '' : ' — picked from your list'}`)
      const planned = nightCity(st, p.start)
      if (planned && !samePlace(planned, h.city)) st.warnings.push(`${h.name} is in ${h.city}, but the itinerary has ${planned} that night`)
      if (addDays(p.start, p.nights) > addDays(start, st.nights)) st.warnings.push(`${h.name} runs past the trip's last night`)
    }
  },

  ADD_STAY(st, a) {
    const nights = toInt(a.nights)
    if (!(nights >= 1)) return st.warnings.push('Say how many nights the new stay is')
    if (!needDates(st)) return
    const hotel = findById(st.catalog.hotels, a.hotelId)
    if (a.hotelId != null && !hotel) st.warnings.push(`Hotel #${a.hotelId} is not in your hotel list`)
    const city = hotel?.city || String(a.city || '').trim()
    const name = hotel?.name || String(a.hotelName || '').trim()
    if (!city) return st.warnings.push(`Which city is ${name || 'the new hotel'} in? Stay not added`)

    // The trip already plans nights with no hotel yet (Trip Info + Itinerary
    // filled, Logistics empty): book the hotel INTO those nights — the open
    // nights in its city first — instead of adding days to the trip.
    if (a.after == null) {
      const open = openNightRuns(st)
      const run = open.find((r) => r.city && samePlace(r.city, city)) || (open.length === 1 || !open.some((r) => r.city) ? open[0] : null)
      if (run && nights <= run.nights) {
        const prev = getStays(st.s.accommodations).filter((x) => x.checkOut <= run.start).pop() || null
        const acc = hotel
          ? pricedStay(st, hotel, run.start, nights, prev, a)
          : { ...pricedStay(st, { id: null, name, city }, run.start, nights, prev, a), category: '', pricePerRoom: 0, bedPrices: [] }
        if (!hotel) st.warnings.push(`${name || 'The new hotel'} is not in your hotel list — price not set`)
        else if (hotel.is_available === false) st.warnings.push(`${hotel.name} is marked unavailable`)
        st.s.accommodations.push(acc)
        st.s.accommodations.sort((x, y) => String(x.checkIn || '').localeCompare(String(y.checkIn || '')))
        const price = acc.pricePerRoom ? `, ${money(acc.pricePerRoom)}/room/night` : ''
        st.changes.push(`Added ${city} stay: ${name || 'hotel'}, ${plural(nights, 'night')} (${fmtRange(acc.checkIn, acc.checkOut)}${price})`)
        if (run.city && !samePlace(run.city, city)) st.warnings.push(`${name || 'The hotel'} is in ${city}, but the itinerary has ${run.city} on those nights`)
        return
      }
    }

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
    // Rooms / room type / meal plan / extra beds said with "add N nights at X".
    const acc = hotel
      ? pricedStay(st, hotel, pivot, nights, neighbour, a)
      : {
          ...pricedStay(st, { id: null, name, city }, pivot, nights, neighbour, a),
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
    // A hotel search can also pick the room type and meal plan it quoted.
    const mealLabel = a.mealPlan ? MEAL_PLAN_LABEL[a.mealPlan] || '' : ''
    const sameHotel = String(hotel.id) === String(acc.hotelId)
    if (sameHotel && !a.roomType && !mealLabel) return
    const oldName = acc.name || 'hotel'
    const oldCity = acc.city || ''
    const types = hotelRoomTypes(hotel)
    const wanted = a.roomType || acc.roomType
    const roomType = types.find((t) => toRoomTypeSlug(t) === toRoomTypeSlug(wanted)) || types[0] || acc.roomType || 'Deluxe'
    const section = findRateSection(hotel, roomType, acc.checkIn, a.mealPlan)
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
      ...(mealLabel ? { mealPlan: mealLabel } : {}),
    })
    const price = section.price ? ` (${money(section.price)}/room/night)` : ''
    const extra = [a.roomType ? roomType : '', mealLabel].filter(Boolean).join(', ')
    st.changes.push(
      sameHotel
        ? `${acc.city} hotel: ${hotel.name} — ${extra}${price}`
        : `${oldCity || acc.city} hotel: ${oldName} → ${hotel.name}${extra ? `, ${extra}` : ''}${price}`,
    )
    if (!section.price) st.warnings.push(`${hotel.name} has no rate for these dates — price not set`)
    if (hotel.is_available === false) st.warnings.push(`${hotel.name} is marked unavailable`)
    if (oldCity && acc.city && !sameName(oldCity, acc.city) && !samePlace(oldCity, acc.city)) {
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

  // "add 1 extra bed at highlands park" / "no extra bed": adult extra beds on a stay.
  SET_EXTRA_BEDS(st, a) {
    const beds = toInt(a.beds)
    if (!(beds >= 0)) return st.warnings.push('Say how many extra beds')
    const stays = a.stay === 'all' ? getStays(st.s.accommodations) : [stayAt(st, a.stay)].filter(Boolean)
    if (!stays.length) return st.warnings.push('There are no hotels on this trip')
    stays.forEach((acc) => {
      const was = toInt(acc.extraBedsAbove12Count) || 0
      if (was === beds) return
      acc.extraBedsAbove12Count = String(beds)
      st.changes.push(`${hotelStay(acc)} extra beds: ${was} → ${beds}`)
    })
  },

  // "grand mumtaz room rate 5500": the agent's own negotiated rate.
  SET_HOTEL_RATE(st, a) {
    const price = Number(a.price)
    if (!(price > 0)) return st.warnings.push(`"${a.price}" is not a room rate`)
    const stays = a.stay === 'all' ? getStays(st.s.accommodations) : [stayAt(st, a.stay)].filter(Boolean)
    if (!stays.length) return st.warnings.push('There are no hotels on this trip')
    stays.forEach((acc) => {
      const old = Number(acc.pricePerRoom) || 0
      if (old === price) return
      acc.pricePerRoom = price
      st.changes.push(`${hotelStay(acc)} room rate: ${money(old)} → ${money(price)} per night`)
    })
  },

  SET_MEAL_PLAN(st, a) {
    // "Breakfast + dinner" at Grand Mumtaz is its own rate row: re-price.
    const reprice = (acc) => {
      const hotel = findById(st.catalog.hotels, acc.hotelId)
      const key = Object.keys(MEAL_PLAN_LABEL).find((k) => MEAL_PLAN_LABEL[k] === acc.mealPlan)
      if (!hotel || !key || !(hotel.price_sections || []).some((s) => s.meal_plan === key)) return
      const section = findRateSection(hotel, acc.roomType, acc.checkIn, key)
      if (section.price) {
        acc.pricePerRoom = section.price
        acc.bedPrices = bedPricesFromSection(section)
      }
    }
    const plan = MEAL_PLANS.find((p) => sameName(p, a.mealPlan))
    if (!plan) return st.warnings.push(`"${a.mealPlan}" is not a meal plan (${MEAL_PLANS.join(' / ')})`)
    if (a.stay === 'all') {
      const stays = getStays(st.s.accommodations)
      if (!stays.length) return st.warnings.push('There are no hotels on this trip')
      const changed = stays.filter((acc) => acc.mealPlan !== plan)
      changed.forEach((acc) => {
        acc.mealPlan = plan
        reprice(acc)
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
    reprice(acc)
  },

  SET_VEHICLE(st, a) {
    const vehicles = st.catalog.vehicles || []
    const v = findById(vehicles, a.vehicleId) || (a.vehicleId == null ? findByName(vehicles, a.vehicleName) : null)
    if (!v) return st.warnings.push(`${a.vehicleName || `Vehicle #${a.vehicleId}`} is not in your vehicle list`)
    // The day-wise road cab only — an extra shikara / pony booking stays as it is.
    const cabs = st.s.transportation.filter((t) => isRoadCab({ name: t.vehicleType }))
    if (cabs.length) {
      const changed = cabs.filter((t) => t.vehicleType !== v.name || (t.vehicleId != null && String(t.vehicleId) !== String(v.id)))
      const wasPerTrip = cabs.some(isIncludedCab)
      if (!changed.length && wasPerTrip === (v.rate_type === 'per_trip')) return
      const oldName = mostCommonVehicle(cabs)?.name || 'cab'
      repriceCabs(cabs, v)
      st.changes.push(`Vehicle: ${oldName} → ${v.name} (${plural(cabs.length, 'booking')})`)
      if (v.rate_type !== 'per_trip' && cabs.length === 1 && isFullTripCab(cabs[0]) && st.nights > 0) {
        st.warnings.push(`${v.name} is priced per day but the trip has one full-trip booking — check the Transport tab`)
      }
      return
    }
    if (!needDates(st)) return
    const days = sortDays(st.s.itinerary)
    if (!days.length) return st.warnings.push('The trip has no day plan to book cabs against')
    st.s.transportation.push(...dayWiseCabs({ days: routedDays(st, days), vehicle: v, dateOf: (n) => dateOfDay(st, n), newId }))
    st.s.transportation.sort((x, y) => String(x.date || '').localeCompare(String(y.date || '')))
    st.changes.push(
      v.rate_type === 'per_trip'
        ? `Vehicle: ${v.name} added (${plural(days.length, 'day')}, priced once for the full trip)`
        : `Vehicle: ${v.name} added (${plural(days.length, 'per-day booking')})`,
    )
  },

  // The Add Transport form by voice (parseEdit hAddCab): a cab for the days
  // said (all days if none), quantity, trip type and route. Days that already
  // have a cab get it updated; the rest get a new row. No cab named → the
  // smallest available one that seats the group.
  ADD_CAB(st, a) {
    const vehicles = st.catalog.vehicles || []
    const named = a.vehicleId != null ? findById(vehicles, a.vehicleId) : a.vehicleName ? findByName(vehicles, a.vehicleName) : null
    if ((a.vehicleId != null || a.vehicleName) && !named) return st.warnings.push(`${a.vehicleName || `Vehicle #${a.vehicleId}`} is not in your vehicle list`)
    // Just "add innova" on a trip that has cabs: change them all (as before).
    if (named && a.days == null && !a.quantity && !a.tripType && !a.route && st.s.transportation.length) return HANDLERS.SET_VEHICLE(st, a)
    const ti = st.s.tripInfo
    const guests = (Number(ti.adults) || 0) + (Number(ti.kids5to12) || 0)
    // A shikara / pony / gondola named from the Transportation list is an extra
    // booking on its day — never in place of the day's road cab.
    if (named && !isRoadCab(named)) {
      if (!needDates(st)) return
      const pick = sortDays(st.s.itinerary).filter((d) => !a.days || a.days.includes(Number(d.day)))
      if (!pick.length) return st.warnings.push('Those days are not on the trip')
      for (const d of pick) {
        st.s.transportation.push({
          id: newId(), vehicleId: named.id, tripType: a.tripType || 'Sightseeing', route: a.route || named.name,
          destination: d.location || '', date: dateOfDay(st, d.day), vehicleType: named.name, quantity: a.quantity || 1, remarks: '', markupPercentage: '',
        })
      }
      st.s.transportation.sort((x, y) => String(x.date || '').localeCompare(String(y.date || '')))
      st.changes.push(`Added ${named.name} on ${pick.length === 1 ? `day ${pick[0].day}` : plural(pick.length, 'day')} (alongside the cab)`)
      return
    }
    const v = named || pickVehicle(vehicles, Math.max(1, guests), st.catalog.memory)
    if (!v) return st.warnings.push('No cab in your vehicle list seats the group — add one in Transportation')
    if (!needDates(st)) return
    const all = sortDays(st.s.itinerary)
    if (!all.length) return st.warnings.push('The trip has no day plan to book cabs against')
    const days = a.days ? all.filter((d) => a.days.includes(Number(d.day))) : all
    if (!days.length) return st.warnings.push('Those days are not on the trip')
    const rows = dayWiseCabs({ days: routedDays(st, days), vehicle: v, dateOf: (n) => dateOfDay(st, n), newId, quantity: a.quantity || 1 })
    let added = 0
    let updated = 0
    for (const row of rows) {
      if (a.tripType) row.tripType = a.tripType
      if (a.route) row.route = a.route
      const existing = st.s.transportation.find((t) => t.date === row.date && isRoadCab({ name: t.vehicleType }))
      if (existing) {
        Object.assign(existing, { vehicleId: row.vehicleId, vehicleType: row.vehicleType, quantity: row.quantity, remarks: row.remarks || existing.remarks })
        if (a.tripType) existing.tripType = a.tripType
        if (a.route) existing.route = a.route
        updated += 1
      } else {
        st.s.transportation.push(row)
        added += 1
      }
    }
    st.s.transportation.sort((x, y) => String(x.date || '').localeCompare(String(y.date || '')))
    const which = a.days ? (days.length === 1 ? `day ${days[0].day}` : `days ${days.map((d) => d.day).join(', ')}`) : `all ${plural(days.length, 'day')}`
    const qty = (a.quantity || 1) > 1 ? ` ×${a.quantity}` : ''
    const extra = [a.tripType, a.route].filter(Boolean).join(', ')
    st.changes.push(`Cab: ${v.name}${qty} for ${which}${extra ? ` (${extra})` : ''}${named ? '' : ' — picked for the group'}${updated ? ` · ${updated} updated` : ''}${added && updated ? ` · ${added} added` : ''}`)
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

  // "quote ₹45,000 all inclusive": the trip margin that lands on that total.
  SET_TARGET_TOTAL(st, a) {
    const amount = Number(a.amount)
    if (!(amount > 0)) return st.warnings.push(`"${a.amount}" is not a price`)
    const p = typeof st.settings.priceOf === 'function' ? st.settings.priceOf(st.s) : null
    if (!p || !(p.base > 0)) return st.warnings.push('Add hotels, a cab or activities first — there is no cost to price yet')
    const pct = marginForTotal(p, amount, { gstPct: st.s.gstPercentage, includeGST: st.s.includeGST !== false })
    if (pct == null) {
      const floor = (p.flexBase + p.fixedMarked) * (1 + (st.s.includeGST !== false ? (Number(st.s.gstPercentage) || 0) / 100 : 0))
      return st.warnings.push(`${money(amount)} is below cost — the lowest total with no margin is ${money(Math.ceil(floor))}. Nothing changed.`)
    }
    const old = Number(st.s.profitMarginPercentage) || 0
    st.s.profitMarginPercentage = pct
    st.changes.push(`Margin: ${old}% → ${pct}% (total ${money(amount)})`)
  },

  // "make the margin ₹10,000": the trip margin that earns that much.
  SET_MARGIN_AMOUNT(st, a) {
    const amount = Number(a.amount)
    if (!(amount >= 0)) return st.warnings.push(`"${a.amount}" is not an amount`)
    const p = typeof st.settings.priceOf === 'function' ? st.settings.priceOf(st.s) : null
    if (!p || !(p.base > 0)) return st.warnings.push('Add hotels, a cab or activities first — there is no cost to put a margin on yet')
    const pct = marginForProfit(p, amount)
    if (pct == null) return st.warnings.push(`Item margins already earn more than ${money(amount)}. Nothing changed.`)
    const old = Number(st.s.profitMarginPercentage) || 0
    st.s.profitMarginPercentage = pct
    st.changes.push(`Margin: ${old}% → ${pct}% (${money(amount)} profit)`)
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

  // "day 3 Gulmarg to Pahalgam", "day 1 arrival in Srinagar … day 6 departure":
  // re-plan the days that were spoken (dayPlan.js), keep the rest, then fit
  // hotels (one per night's city, reusing the trip's own where the city
  // matches), each day's destination and the day-wise cab routes to it.
  SET_DAY_ROUTES(st, a) {
    if (!needDates(st)) return
    const cat = prepareCatalog(st.catalog)
    const findCity = (w) => cityLookup(w, cat)
    const cityName = (raw) => (raw ? findCity(String(raw).toLowerCase().replace(/,.*$/, '').split(/\s+/)) || String(raw).split(',')[0].trim() : null)
    const days = sortDays(st.s.itinerary)
    const live = getStays(st.s.accommodations)
    const base = days.map((d, i) => {
      const date = dateOfDay(st, i + 1)
      const acc = live.find((x) => x.checkIn <= date && date < x.checkOut)
      return {
        overnight: i === days.length - 1 ? null : cityName(acc?.city) || cityName(d.location),
        title: stripDayPrefix(d.title),
        location: d.location,
      }
    })
    const plan = buildDayPlan({ entries: a.entries }, { base, firstCity: base[0]?.overnight || '' })
    if (!plan.days.some((p) => p.changed)) return st.warnings.push('That day plan matches the trip already')

    // ── itinerary
    const newDays = plan.days.map((p, i) => {
      const old = days[i]
      if (old && !p.changed) {
        old.day = i + 1
        old.title = `Day ${i + 1}: ${stripDayPrefix(old.title)}`
        return old
      }
      const dest = findDestination(st.catalog, p.location)
      const lines = p.kind === 'leisure' ? [LEISURE_LINE] : p.kind === 'departure' ? [] : cityLines(st.catalog, p.location)
      const day = old || { id: newId(), photo: null }
      day.day = i + 1
      day.title = `Day ${i + 1}: ${p.title}`
      day.location = p.location
      day.destination = dest?.name || p.location
      day.destinationId = dest?.id ?? null
      if (!old || !sameName(old.location, p.location) || p.kind === 'leisure') setLines(day, lines)
      if (dest && (dest.image_url || dest.image_path) && (!old || !sameName(old.location, p.location))) day.photo = dest.image_url || dest.image_path
      st.changes.push(`Day ${i + 1}: ${p.title}`)
      return day
    })
    st.s.itinerary = newDays

    // ── hotels: one stay per run of nights in a city
    const pref = {}
    const used = new Set()
    const nextAcc = []
    for (const stay of plan.stays) {
      const checkIn = dateOfDay(st, stay.fromDay)
      const checkOut = addDays(checkIn, stay.nights)
      const reuse = live.find((x) => !used.has(x) && samePlace(x.city, stay.city) && x.checkIn < checkOut && checkIn < x.checkOut)
      if (reuse) {
        used.add(reuse)
        if (reuse.checkIn !== checkIn || reuse.checkOut !== checkOut) {
          const before = reuse.checkIn
          reuse.checkIn = checkIn
          reuse.checkOut = checkOut
          repriceForDates(st, reuse, before)
          st.changes.push(`${hotelStay(reuse)}: ${reuse.name} · ${plural(stay.nights, 'night')} (${fmtRange(checkIn, checkOut)})`)
        }
        nextAcc.push(reuse)
        continue
      }
      // A hotel already used in this city elsewhere on the trip, else the usual / a sensible one.
      const same = live.find((x) => samePlace(x.city, stay.city) && x.hotelId)
      const hotel = (same && findById(st.catalog.hotels, same.hotelId)) || pickHotel(stay.city, st.catalog.hotels || [], pref, st.catalog.memory || null)
      if (!hotel) {
        st.warnings.push(`No hotel in ${stay.city} in your catalog — add one for ${fmtRange(checkIn, checkOut)} in Logistics`)
        continue
      }
      const acc = pricedStay(st, hotel, checkIn, stay.nights, live[0])
      acc.city = stay.city
      nextAcc.push(acc)
      st.changes.push(`${stay.city}: ${hotel.name} · ${plural(stay.nights, 'night')} (picked for you)`)
    }
    live.filter((x) => !used.has(x)).forEach((x) => st.changes.push(`Removed ${hotelStay(x)} stay (${x.name || 'hotel'})`))
    st.s.accommodations = [...st.s.accommodations.filter(isCancelled), ...nextAcc]

    // ── cabs: the changed days get their new route; days past the end go
    const template = mostCommonVehicle(st.s.transportation)
    const vehicle = template ? findById(st.catalog.vehicles, template.id) || findByName(st.catalog.vehicles, template.name) || { id: template.id, name: template.name } : null
    const lastDate = dateOfDay(st, plan.days.length)
    const cabs = st.s.transportation.filter((t) => !t.date || t.date <= lastDate)
    if (vehicle) {
      plan.days.forEach((p, i) => {
        if (!p.changed) return
        const date = dateOfDay(st, i + 1)
        const row = cabs.find((t) => t.date === date && !isFullTripCab(t))
        const route = p.route || p.title
        if (row) {
          row.route = route
          row.tripType = p.tripType || row.tripType
          row.destination = p.location || row.destination
        } else {
          cabs.push(...dayWiseCabs({ days: [{ day: i + 1, title: p.title, location: p.location, route, tripType: p.tripType }], vehicle, dateOf: () => date, newId }))
        }
      })
    }
    st.s.transportation = cabs.sort((x, y) => String(x.date || '').localeCompare(String(y.date || '')))
    st.nights = plan.nights
  },

  INCLUSION(st, a) {
    const r = applyInclusion(st.s, a, st.catalog.standard || {})
    if (r.change) st.changes.push(r.change)
    if (r.warning) st.warnings.push(r.warning)
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
      const value = key === 'clientPhone' && String(a[key]).trim() ? formatPhone(a[key]) : String(a[key]).trim()
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
    // Adults buy adult tickets, kids 5-12 child tickets. Nothing said → the
    // trip's own guests; "for 4 people" → 4 adult tickets.
    const ti = st.s.tripInfo
    const spokenPersons = toInt(a.persons) >= 1 ? toInt(a.persons) : null
    const spokenKids = toInt(a.children) >= 0 && a.children != null ? toInt(a.children) : null
    const persons = spokenPersons ?? Math.max(1, Number(ti.adults) || 0)
    const kids = spokenKids ?? (spokenPersons != null ? 0 : Number(ti.kids5to12) || 0)
    // Priced from the catalog's rate sheet: the option said ("phase 2") and
    // the season covering that day's date.
    const option = activityRateOptions(cat).find((o) => sameName(o, a.option || '')) || ''
    const rate = cat ? findActivityRate(cat, { option, date: dateForDay(ti.startDate, dayNumber) }) : null
    const rawPrice = a.pricePerTicket ?? (cat && (rate.price || cat.selling_price != null) ? rate.price : null)
    const price = rawPrice == null || rawPrice === '' ? null : Number(rawPrice)
    const childPrice = kids > 0 && price != null ? (a.pricePerTicket == null && rate?.childPrice) || price : ''
    st.s.tripActivities.push({
      id: newId(),
      activityId: cat?.id ?? null,
      name,
      location,
      dayNumber,
      ticketCount: String(persons),
      childCount: String(kids),
      pricePerTicket: price == null ? '' : price,
      childPrice,
      costPerTicket: rate?.cost || '',
      childCost: kids > 0 ? rate?.childCost || rate?.cost || '' : '',
      rateOption: rate?.option || '',
      markupPercentage: '',
      notes: '',
    })
    const who = kids > 0 ? `${plural(persons, 'adult')} + ${kids} ${kids === 1 ? 'child' : 'children'}` : plural(persons, 'person')
    const cost =
      price == null
        ? `${who}, price not set`
        : kids > 0
          ? `${persons} × ${money(price)} + ${kids} × ${money(childPrice)}`
          : `${persons} × ${money(price)}`
    st.changes.push(`Added ${name}${rate?.option ? ` — ${rate.option}` : ''}${dayNumber ? ` on day ${dayNumber}` : ''} (${cost})`)
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

  keepPerTripPriced(s.transportation, st.catalog.vehicles)

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

  return { snapshot: s, changes: st.changes, warnings: st.warnings }
}
