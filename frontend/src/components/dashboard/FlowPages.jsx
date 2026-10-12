import React, { useLayoutEffect, useRef, useState, useEffect, useId } from "react";

// Measured page flow for the itinerary templates (Modern + Classic).
//
// The template pages are fixed A4 boxes (297mm, overflow hidden), so content
// that is taller than a guess gets cut off ("bleeds"), and a section that
// always starts a fresh page leaves half-empty pages behind. FlowPages lays
// sections (hotel cards, transport rows, activity rows, …) out by their REAL
// rendered heights: it renders every block once in a hidden measuring page
// (same CSS, same width), then packs them page by page — a section continues
// on the same page as the one before it while there is room, a table breaks
// between rows (its header repeated), and nothing is ever clipped.
//
// The measuring runs in a layout effect, i.e. before the browser paints, and
// again once web fonts finish loading. The PDF export clones the rendered
// pages, so it gets exactly this layout. The measuring page does NOT carry
// the template's page class, so the export never captures it.
//
// sections: [{
//   key,
//   title,          // passed to renderTop for the page this section opens
//   bar,            // heading node shown above the section on a page
//   table: { className, head } | undefined,   // rows of a table section are <tr>s
//   items: [{ key, node }],
//   after,          // optional node right after the section's last item
//   wrap: { className, style } | undefined,   // container around the table / each item
// }]

const SAFETY_PX = 6;

const flowRoot = { display: "flow-root" };
const wrapProps = (section, extra = {}) => ({
  className: section.wrap?.className,
  style: { ...flowRoot, ...(section.wrap?.style || {}) },
  ...extra,
});

function sameLayout(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function SectionBody({ section, from, to, withBar, withAfter }) {
  const items = section.items.slice(from, to);
  return (
    <>
      {withBar && section.bar ? <div style={flowRoot}>{section.bar}</div> : null}
      {section.table ? (
        <div {...wrapProps(section)}>
          <table className={section.table.className}>
            {section.table.head}
            <tbody>{items.map((it) => <React.Fragment key={it.key}>{it.node}</React.Fragment>)}</tbody>
          </table>
        </div>
      ) : (
        items.map((it) => (
          <div {...wrapProps(section)} key={it.key}>
            {it.node}
          </div>
        ))
      )}
      {withAfter && section.after ? <div style={flowRoot}>{section.after}</div> : null}
    </>
  );
}

export default function FlowPages({
  sections,
  pageClassName,
  renderTop,
  renderBottom,
  barOnFirstSection = true,
}) {
  const live = sections.filter((s) => s && s.items && s.items.length);
  const measureRef = useRef(null);
  const [layout, setLayout] = useState(null);
  const [fontsTick, setFontsTick] = useState(0);
  // Correction per page (px): a table split over pages can lay its columns
  // out a little differently than the measured whole table, so rows can come
  // out taller. A rendered page that still overflows gets less room next pass.
  // Kept with the measurements it was made for (sig): new content or a font
  // that arrived starts from a clean slate.
  const [penaltyState, setPenalty] = useState({ sig: "", map: {} });
  const flowId = useId();

  // Text reflows when a web font arrives (the template @imports its font), so
  // measure again whenever one finishes loading.
  useEffect(() => {
    let alive = true;
    const bump = () => alive && setFontsTick((n) => n + 1);
    document.fonts?.ready?.then(bump).catch(() => {});
    document.fonts?.addEventListener?.("loadingdone", bump);
    return () => {
      alive = false;
      document.fonts?.removeEventListener?.("loadingdone", bump);
    };
  }, []);

  // Measure → lay out, before paint. Runs after every render (content can
  // change anywhere in a section); setLayout bails out when nothing moved.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    const avail = root.querySelector("[data-flow-space]")?.offsetHeight || 0;
    if (!avail) return;
    const pageHeight = root.querySelector("[data-flow-probe]")?.offsetHeight || 0;
    const sig = `${avail}:${root.offsetHeight}:${live.length}`;
    const penalty = penaltyState.sig === sig ? penaltyState.map : {};

    // Rendered pages that overflow even though their layout was made from
    // these very measurements → give those pages less room. (A layout from
    // older measurements — before a font arrived — is simply redone.)
    if (layout && layout.sig === sig) {
      const rendered = root.parentElement?.querySelectorAll(`[data-flow-page="${flowId}"]`) || [];
      let bump = null;
      rendered.forEach((pg, i) => {
        const over = pg.scrollHeight - pageHeight;
        if (pageHeight && over > 1 && (penalty[i] || 0) < avail / 2) {
          bump = bump || { ...penalty };
          bump[i] = (bump[i] || 0) + over + 4;
        }
      });
      if (bump) {
        setPenalty({ sig, map: bump });
        return;
      }
    }

    // A page's space for content (the probe page has an empty body).
    const capacityOf = (pageIndex) => avail - SAFETY_PX - (penalty[pageIndex] || 0);
    const next = [];
    let page = { blocks: [], used: 0 };
    const pushPage = () => {
      if (page.blocks.length) next.push(page);
      page = { blocks: [], used: 0 };
    };
    live.forEach((section, si) => {
      const el = root.querySelector(`[data-flow-section="${si}"]`);
      if (!el) return;
      const bar = el.querySelector("[data-flow-bar]")?.offsetHeight || 0;
      const after = el.querySelector("[data-flow-after]")?.offsetHeight || 0;
      let head = 0;
      let frame = 0;
      let heights;
      if (section.table) {
        const wrap = el.querySelector("[data-flow-table]");
        const rows = Array.from(wrap.querySelectorAll("tbody > tr"));
        heights = rows.map((r) => r.getBoundingClientRect().height);
        head = wrap.querySelector("thead")?.getBoundingClientRect().height || 0;
        const rowsSum = heights.reduce((n, h) => n + h, 0);
        frame = Math.max(0, wrap.getBoundingClientRect().height - rowsSum - head);
      } else {
        heights = Array.from(el.querySelectorAll("[data-flow-item]")).map((n) => n.getBoundingClientRect().height);
      }
      let i = 0;
      while (i < heights.length) {
        const showBar = page.blocks.length > 0 || barOnFirstSection;
        const opening = (showBar ? bar : 0) + head + frame;
        // Don't leave a heading with a single item under it at a page's foot.
        const heading = (showBar && bar) || head;
        const firstTwo = heights[i] + (heading && i === 0 && heights.length > 1 ? heights[1] : 0);
        if (page.blocks.length && page.used + opening + firstTwo > capacityOf(next.length)) pushPage();
        const capacity = capacityOf(next.length);
        const barNow = page.blocks.length > 0 || barOnFirstSection;
        let used = page.used + (barNow ? bar : 0) + head + frame;
        const from = i;
        while (i < heights.length && (i === from || used + heights[i] <= capacity)) {
          used += heights[i];
          i += 1;
        }
        const last = i >= heights.length;
        // The note after a table needs room too; else the last row moves on.
        if (last && after && used + after > capacity && i - from > 1) {
          i -= 1;
          used -= heights[i];
        }
        const done = i >= heights.length;
        page.blocks.push({ s: si, from, to: i, bar: barNow, after: done });
        page.used = used + (done ? after : 0);
        if (!done) pushPage();
      }
    });
    pushPage();
    const result = { pages: next.map((p) => p.blocks), sig };
    setLayout((prev) => (prev && sameLayout(prev, result) ? prev : result));
  });

  // Before the first measurement: one page per section (replaced before paint).
  const pages =
    layout?.pages ||
    live.map((s, si) => [{ s: si, from: 0, to: s.items.length, bar: barOnFirstSection, after: true }]);

  return (
    <>
      {pages.map((blocks, pi) => {
        const first = live[blocks[0]?.s];
        return (
          <div className={pageClassName} key={`flow-${pi}-${first?.key || pi}`} data-flow-page={flowId}>
            {renderTop(first)}
            {blocks.map((b) => {
              const section = live[b.s];
              if (!section) return null;
              return (
                <SectionBody
                  key={`${section.key}-${b.from}`}
                  section={section}
                  from={b.from}
                  to={b.to}
                  withBar={b.bar}
                  withAfter={b.after}
                />
              );
            })}
            <div style={{ flex: 1 }}></div>
            {renderBottom()}
          </div>
        );
      })}

      {/* Hidden measuring page: same width/height and CSS scope, no page class. */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="flow-measure"
        data-fonts={fontsTick}
        style={{
          position: "absolute",
          left: "-100000px",
          top: 0,
          width: "210mm",
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        <div
          data-flow-probe=""
          style={{ width: "210mm", height: "297mm", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}
        >
          <div data-flow-top="" style={flowRoot}>
            {renderTop(live[0])}
          </div>
          <div data-flow-space="" style={{ flex: 1 }}></div>
          {renderBottom()}
        </div>
        {live.map((section, si) => (
          <div key={section.key} data-flow-section={si} style={{ width: "210mm", position: "relative" }}>
            {section.bar ? (
              <div data-flow-bar="" style={flowRoot}>
                {section.bar}
              </div>
            ) : null}
            {section.table ? (
              <div {...wrapProps(section, { "data-flow-table": "" })}>
                <table className={section.table.className}>
                  {section.table.head}
                  <tbody>{section.items.map((it) => <React.Fragment key={it.key}>{it.node}</React.Fragment>)}</tbody>
                </table>
              </div>
            ) : (
              section.items.map((it) => (
                <div {...wrapProps(section, { "data-flow-item": "" })} key={it.key}>
                  {it.node}
                </div>
              ))
            )}
            {section.after ? (
              <div data-flow-after="" style={flowRoot}>
                {section.after}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
