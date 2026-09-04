import { expect, test } from '@playwright/test';

import type { MatcherInput, RulesetVersion } from '@nilam/engine';

import engineCases from '../../apps/web/lib/fixtures/nilam-engine-cases.json';
import { serializeMatcherState } from '../../apps/web/lib/matcher-state';

/**
 * Arithmetic expectations come from committed @nilam/engine fixtures. Layout,
 * mobile, Tamil, navigation, playbook and land assertions remain independent.
 */

function engineFixture(name: string) {
  const fixture = engineCases.find((candidate) => candidate.name === name);
  if (fixture === undefined) throw new Error(`Missing engine fixture: ${name}`);
  return fixture;
}

function formatLakhs(value: number) {
  return value >= 100 ? `₹${value / 100}Cr` : `₹${value}L`;
}

function canonicalPath(name: string) {
  const fixture = engineFixture(name);
  const query = serializeMatcherState({
    input: fixture.input as MatcherInput,
    ruleset: fixture.expected.ruleset as RulesetVersion,
  });
  return `/?${query}`;
}

const defaultFixture = engineFixture('default');
const firstGenerationOffFixture = engineFixture('first-generation-off');
const pmfmeFixture = engineFixture('pmfme-existing');
const TOTAL = formatLakhs(defaultFixture.expected.totalLakhs);
const PROJECT = formatLakhs(defaultFixture.input.projectCostLakhs);

test.describe('NILAM App — ported design', () => {
  test('matcher computes the documented default stack', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByText('NILAM', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Cited schemes and TANSIDCO plots, one computed answer.',
      }),
    ).toBeVisible();

    // Inputs echo the default state.
    await expect(page.getByText(PROJECT, { exact: true })).toBeVisible();

    // Total is pinned to the engine-derived fixture.
    await expect(page.getByText(TOTAL, { exact: true }).first()).toBeVisible();

    await expect(
      page.getByText(
        `Your scheme stack · ${defaultFixture.expected.eligible.length} schemes`,
      ),
    ).toBeVisible();
    for (const { name } of defaultFixture.expected.eligible) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }

    // Pending schemes do not leak into eligibility or conflict totals.
    await expect(
      page.getByText('Conflicts resolved', { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText('TN Capital Subsidy', { exact: true }),
    ).toHaveCount(0);

    await expect(page.getByText('Near misses')).toBeVisible();
    for (const { name } of defaultFixture.expected.nearMisses) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText('Stand-Up India', { exact: true })).toHaveCount(
      0,
    );

    for (const step of defaultFixture.expected.sequence) {
      await expect(page.getByText(step, { exact: true })).toBeVisible();
    }

    // Land ranking is district-then-backward-then-vacancy, over the real
    // TANSIDCO snapshot. Thanjavur + backward block puts Palayapatti first
    // (Thanjavur, backward, 21 vacant → score 8).
    await expect(page.getByText('Palayapatti')).toBeVisible();
  });

  test('turning off first-generation matches the engine fixture', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('button', { name: /First-generation entrepreneur/ })
      .click();

    await expect(
      page.getByText(
        `Your scheme stack · ${firstGenerationOffFixture.expected.eligible.length} schemes`,
      ),
    ).toBeVisible();
    for (const { name } of firstGenerationOffFixture.expected.eligible) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText('Near misses')).toBeVisible();
    await expect(
      page.getByText(
        firstGenerationOffFixture.expected.nearMisses[0]?.name ?? '',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page
        .getByText(formatLakhs(firstGenerationOffFixture.expected.totalLakhs), {
          exact: true,
        })
        .first(),
    ).toBeVisible();
  });

  test('internal views render and trust links reach real surfaces', async ({
    page,
  }) => {
    await page.goto('/');
    const views: [string, string][] = [
      ['Land Explorer', 'Government industrial land, plot by plot.'],
      ['Schemes', 'Scheme encyclopedia'],
      ['Playbooks', 'Playbooks'],
    ];
    for (const [nav, heading] of views) {
      await page
        .getByRole('button', { name: nav, exact: true })
        .first()
        .click();
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }

    await page
      .getByRole('button', { name: 'Saved', exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/account(?:\/sign-in)?/u);
    await expect(
      page.getByRole('heading', { name: 'Sign in without a password' }),
    ).toBeVisible();

    await page.goto('/');
    await page
      .getByRole('button', { name: 'Changelog', exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/changelog$/u);
    await expect(
      page.getByRole('heading', { name: 'Ruleset changelog' }),
    ).toBeVisible();
  });

  test('PMFME detail uses its eligible engine fixture', async ({ page }) => {
    await page.goto(canonicalPath('pmfme-existing'));
    await expect(
      page
        .getByText(formatLakhs(pmfmeFixture.expected.totalLakhs), {
          exact: true,
        })
        .first(),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Schemes', exact: true })
      .first()
      .click();
    await page.getByRole('button', { name: /PMFME/ }).first().click();

    await expect(page.getByRole('heading', { name: 'PMFME' })).toBeVisible();
    await expect(page.getByText('Do you qualify?')).toBeVisible();
    await expect(
      page.getByText(formatLakhs(pmfmeFixture.expected.totalLakhs), {
        exact: true,
      }),
    ).toHaveCount(3);

    await page.getByRole('button', { name: '← Scheme encyclopedia' }).click();
    await expect(
      page.getByRole('heading', { name: 'Scheme encyclopedia' }),
    ).toBeVisible();
  });

  test('playbook progress counts up and survives a reload', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('button', { name: 'Playbooks', exact: true })
      .first()
      .click();
    await expect(page.getByText('0 / 7 done')).toBeVisible();

    await page.getByRole('button', { name: 'Udyam registration' }).click();
    await expect(page.getByText('1 / 7 done')).toBeVisible();

    await page.reload();
    await page
      .getByRole('button', { name: 'Playbooks', exact: true })
      .first()
      .click();
    await expect(page.getByText('1 / 7 done')).toBeVisible();
  });

  test('Tamil switches the whole interface', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'தமிழ்' }).click();
    await expect(page.getByRole('button', { name: 'பொருத்தி' })).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'மேற்கோள் திட்டங்களும் TANSIDCO மனைகளும் — ஒரே கணக்கிடப்பட்ட பதில்.',
      }),
    ).toBeVisible();
  });

  test('search spans every district TANSIDCO publishes', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('button', { name: 'Land Explorer', exact: true })
      .first()
      .click();
    const box = page.getByLabel('Search estates');
    await expect(page.getByText(/85 of 85 (?:estates )?·/)).toBeVisible();

    // The search that used to fail: Kallakurichi has two estates, and
    // Kattuvananjur is one of them — it was never in Thanjavur.
    // The estate name also appears in the detail pane, so assert on the list.
    const rows = page.locator('button.qh-row-paper');

    await box.fill('kallakurichi');
    await expect(page.getByText(/2 of 85 (?:estates )?·/)).toBeVisible();
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: 'Kattuvananjur' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'Asanur' })).toHaveCount(1);

    // Block names are searchable too.
    await box.fill('sankarapuram');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Kattuvananjur');

    // Tokens are ANDed, so this narrows rather than widening.
    await box.fill('kallakurichi asanur');
    await expect(page.getByText(/1 of 85 (?:estates )?·/)).toBeVisible();

    await box.fill('nowhere at all');
    await expect(
      page.getByText('Nothing matches', { exact: false }),
    ).toBeVisible();
  });

  test('sorting and the backward-block filter use published figures', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('button', { name: 'Land Explorer', exact: true })
      .first()
      .click();
    const rows = page.locator('button.qh-row-paper');

    // Cheapest published plot rate per acre across the state: Pidaneri,
    // Thoothukudi at ~₹19.1L/acre. Rental rows are excluded from the rate.
    await page.getByRole('button', { name: 'Cheapest', exact: true }).click();
    await expect(rows.first()).toContainText('Pidaneri');

    // Guindy tops it at ~₹123Cr/acre — central Chennai industrial land.
    await page.getByRole('button', { name: 'Priciest', exact: true }).click();
    await expect(rows.first()).toContainText('Guindy');

    // Karaikudi has 121 vacant units, the most in the snapshot.
    await page.getByRole('button', { name: 'Most vacant' }).click();
    await expect(rows.first()).toContainText('Karaikudi');

    // The backward-block flag is the source's own, not inferred.
    await page.getByRole('button', { name: 'Backward only' }).click();
    await expect(page.getByText(/of 85 (?:estates )?·/)).toBeVisible();
    await expect(rows.first()).toContainText('BB');
  });

  test('surveyed plan draws real polygons and reports real plot facts', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('button', { name: 'Land Explorer', exact: true })
      .first()
      .click();
    await page.getByLabel('Search estates').fill('kattuvananjur');
    await page.locator('button.qh-row-paper').first().click();

    const recordTab = page.getByRole('button', { name: 'Record', exact: true });
    const phoneDetail = await recordTab.isVisible();
    if (phoneDetail) await recordTab.click();

    // Published record, not derived: 42 acres, 52 plots, 21 vacant.
    if (phoneDetail) {
      await expect(
        page.getByText('Kallakurichi · 21 vacant', { exact: false }),
      ).toBeVisible();
    } else {
      await expect(page.getByText('21', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('42 ac', { exact: true })).toBeVisible();
      await expect(
        page.getByText('Kallakurichi district', { exact: false }),
      ).toBeVisible();
      await expect(
        page.getByText('Sankarapuram block', { exact: false }),
      ).toBeVisible();
    }

    if (phoneDetail) {
      await page.getByRole('button', { name: 'Plan', exact: true }).click();
    }

    // The GIS layer supplies 199 polygons here: 176 parcels, 22 roads and
    // reservations, and the estate boundary.
    await expect(page.getByText('176 parcels', { exact: false })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText('22 roads and reservations', { exact: false }),
    ).toBeVisible();
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();

    if (phoneDetail) {
      await page
        .getByRole('button', { name: 'Available 21', exact: true })
        .click();
    }

    // Cheapest available plot here is ₹3.26L; the rate shown is per acre.
    await expect(
      page.getByText('Available now', { exact: false }),
    ).toBeVisible();

    if (phoneDetail) await recordTab.click();

    // Branch office comes from the estate record.
    await expect(page.getByText('Where to apply')).toBeVisible();
    await expect(
      page.getByText('bmcdr@tansidco.org', { exact: false }),
    ).toBeVisible();

    // No approach roads are published, and the view says so instead of guessing.
    await expect(
      page.getByText('Approach roads and rail distances are not published', {
        exact: false,
      }),
    ).toBeVisible();
  });

  test('run matcher here carries the real district across', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('button', { name: 'Land Explorer', exact: true })
      .first()
      .click();
    await page.getByLabel('Search estates').fill('kattuvananjur');
    await page.locator('button.qh-row-paper').first().click();
    const recordTab = page.getByRole('button', { name: 'Record', exact: true });
    if (await recordTab.isVisible()) await recordTab.click();
    await page.getByRole('button', { name: 'Run matcher here' }).click();

    // Kallakurichi is not one of the prototype's ten districts — the dropdown
    // is driven by the snapshot, so it can actually hold this value.
    await expect(page.getByLabel('District')).toHaveValue('Kallakurichi');
  });

  test('phone layout is master → detail, each screen owning the viewport', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    const noScroll = async () =>
      page.evaluate(() => ({
        v:
          document.documentElement.scrollHeight >
          document.documentElement.clientHeight + 1,
        h:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1,
      }));

    await page.goto('/');
    await page
      .getByRole('button', { name: 'Land Explorer', exact: true })
      .click();

    // The list screen: no page scroll in either axis. The header wraps to two
    // rows rather than overlapping the nav, which used to swallow its taps.
    await expect(page.getByLabel('Search estates')).toBeVisible();
    expect(await noScroll()).toEqual({ v: false, h: false });

    // Tapping an estate pushes a detail screen rather than shrinking a column.
    await page.getByLabel('Search estates').fill('kattuv');
    await page.getByText('Kattuvananjur').first().click();
    await expect(
      page.getByRole('button', { name: /All estates/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Plan', exact: true }),
    ).toBeVisible();
    expect(await noScroll()).toEqual({ v: false, h: false });

    // Each tab fills the screen on its own.
    await page.getByRole('button', { name: /^Available/ }).click();
    await expect(
      page.getByText('Available now', { exact: false }),
    ).toBeVisible();
    expect(await noScroll()).toEqual({ v: false, h: false });

    await page.getByRole('button', { name: 'Record', exact: true }).click();
    await expect(page.getByText('Where to apply')).toBeVisible();

    // And back returns to the list.
    await page.getByRole('button', { name: /All estates/ }).click();
    await expect(page.getByLabel('Search estates')).toBeVisible();

    await ctx.close();
  });

  test('every view fits a phone, and the total stays pinned', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    const nav = (name: string) =>
      page.getByRole('navigation').getByRole('button', { name, exact: true });
    const overflows = () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1,
      );

    await page.goto('/');

    // The design's grids are hard `repeat(3,1fr)` and `minmax(320px,420px) 1fr`;
    // nothing may spill sideways once they collapse.
    expect(await overflows()).toBe(false);
    for (const view of ['Schemes', 'Playbooks']) {
      await nav(view).click();
      await expect(page.getByRole('heading').first()).toBeVisible();
      expect(await overflows()).toBe(false);
    }

    // The Matcher pins the computed total while the inputs are being changed —
    // the "recomputes live" promise is otherwise a screen away on a phone.
    await nav('Matcher').click();
    const total = page.locator('.nl-sticky-total');
    await expect(total).toBeVisible();
    await expect(total).toContainText(TOTAL);
    await page.evaluate(() => window.scrollTo(0, 1400));
    const box = await total.boundingBox();
    expect(box).not.toBeNull();
    expect((box as { y: number }).y).toBeLessThan(915);
    expect((box as { y: number; height: number }).y).toBeGreaterThan(0);

    await ctx.close();
  });

  test('matcher: inputs in the first screen, report never buried', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // The design opened with ~480px of landing hero before the first control.
    // Every input and the computed figure belong in the first screen.
    const first = await page.evaluate(() => {
      const within = (selector: string) => {
        const el = document.querySelector(selector);
        return el === null
          ? false
          : el.getBoundingClientRect().bottom <= window.innerHeight + 1;
      };
      return {
        slider: within('input[type="range"]'),
        district: within('select'),
        aside: within('.nl-tool-aside'),
      };
    });
    expect(first).toEqual({ slider: true, district: true, aside: true });
    await expect(page.getByText(TOTAL, { exact: true }).first()).toBeVisible();

    // The figure appears once. It was briefly rendered twice — in the pinned
    // inputs and in the report beside it — which is noise, not reinforcement.
    const visibleTotals = await page.evaluate(
      () =>
        [...document.querySelectorAll('*')].filter(
          (el) =>
            el.children.length === 0 &&
            el.textContent?.trim() === 'Total computed support' &&
            el.getBoundingClientRect().width > 0,
        ).length,
    );
    expect(visibleTotals).toBe(1);

    // Nothing may be hidden inside a scroll pane. An earlier attempt gave both
    // columns `overflow-y:auto` inside a 100svh shell, which buried the stack,
    // the conflicts, the sequence and the ranked land behind no affordance.
    const buried = await page.evaluate(() =>
      [...document.querySelectorAll('*')]
        .filter((el) => {
          const cs = getComputedStyle(el);
          return (
            (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
            el.scrollHeight > el.clientHeight + 2
          );
        })
        .map((el) => String(el.className).slice(0, 40)),
    );
    expect(buried).toEqual([]);

    // …and the pinned column must not scroll sideways either. Range inputs
    // carry a UA margin, so the design's `width:100%` overflowed it by 2px,
    // and `overflow-y:auto` makes the cross axis `auto` too — a stray
    // horizontal scrollbar under the inputs.
    const sideways = await page.evaluate(() => {
      const aside = document.querySelector('.nl-tool-aside');
      return aside === null ? null : aside.scrollWidth - aside.clientWidth;
    });
    expect(sideways).toBe(0);

    // The report keeps its full length, all of it reachable by page scroll.
    for (const section of [
      'Near misses',
      'Application sequence',
      'Ranked land options',
    ]) {
      await expect(page.getByText(section, { exact: true })).toBeVisible();
    }

    // The inputs stay pinned while the report scrolls past them.
    await page.evaluate(() => window.scrollTo(0, 700));
    const pinned = await page.evaluate(() =>
      Math.round(
        document.querySelector('.nl-tool-aside')!.getBoundingClientRect().top,
      ),
    );
    expect(pinned).toBe(64);

    // The pitch is a disclosure, not a wall.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByText('Tell us about your idea')).toHaveCount(0);
    await page.getByRole('button', { name: 'How it works' }).click();
    await expect(page.getByText('Tell us about your idea')).toBeVisible();
  });
});
