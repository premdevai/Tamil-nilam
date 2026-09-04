// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./plot-map', () => ({
  PlotMap: () => <div data-testid="plot-map" />,
  STATUS_LEGEND: [['Vacant', '#0f0']] as const,
}));

import { LandExplorerView } from './land-explorer-view';

const snapshot = {
  source: 'test',
  fetchedAt: '2026-08-21T02:38:11.981Z',
  note: '',
  estateCount: 2,
  plotCount: 5,
  districts: ['Ariyalur', 'Salem'],
  estates: [
    {
      id: 83,
      district: 'Ariyalur',
      name: 'Mallur',
      block: 'Thirumanur',
      backward: true,
      vacant: {
        industrialPlot: 2,
        commercialPlot: 0,
        shed: 0,
        module: 0,
        total: 2,
      },
      gisUrl: 'https://example.test',
      coords: { lat: 11, lon: 79 },
      record: {
        totalAreaAcres: 26.62,
        saleableAreaAcres: 25.041,
        openSpaceAcres: 0,
        roadAreaAcres: 0.602,
        roadLengthM: 1587,
        drainageLengthM: 1387,
        plotCount: 26,
        commercialPlotCount: 3,
        streetLights: 25,
        borewells: 0,
        developedYear: '2014',
        address: 'SIDCO',
        phone: '04312441177',
        email: 'bmtry@tansidco.org',
      },
      polygonCount: 99,
      plots: [
        {
          no: '1',
          extent: 0.37,
          type: 'Industrial Plot',
          costRs: 1_869_018,
          costBasis: 'outright',
        },
        {
          no: '3',
          extent: 0.206,
          type: 'Industrial Plot',
          costRs: 1_196_676,
          costBasis: 'outright',
        },
      ],
    },
    {
      id: 12,
      district: 'Salem',
      name: 'Mettur',
      block: null,
      backward: false,
      vacant: {
        industrialPlot: 0,
        commercialPlot: 0,
        shed: 0,
        module: 3,
        total: 3,
      },
      gisUrl: 'https://example.test/mettur',
      coords: { lat: 11.8, lon: 77.8 },
      record: null,
      polygonCount: 0,
      plots: [
        {
          no: 'A1',
          extent: null,
          type: 'Module',
          costRs: 12,
          costBasis: 'unclear',
        },
      ],
    },
  ],
};

const props = {
  eyebrow: 'Land Explorer',
  title: 'Government industrial land, plot by plot.',
  simpleWords: 'In simple words',
  explain: 'Explainer',
  runHereLabel: 'Run matcher here',
  backwardBadge: 'Backward block',
  onRunMatcher: () => undefined,
};

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((success: PositionCallback) =>
        success({
          coords: { latitude: 11, longitude: 79 },
        } as GeolocationPosition),
      ),
    },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => snapshot,
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Land Explorer nearest sorting', () => {
  it('uses device location by default', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) =>
          success({
            coords: { latitude: 11.8, longitude: 77.8 },
          } as GeolocationPosition),
        ),
      },
    });

    render(<LandExplorerView {...props} />);

    await waitFor(() => {
      expect(document.querySelector('button.qh-row-paper')).toHaveTextContent(
        'Mettur',
      );
    });
    expect(screen.getByRole('combobox', { name: 'Sort estates' })).toHaveValue(
      'nearest',
    );
    expect(document.querySelector('button.qh-row-paper')).toHaveTextContent(
      '<1 km away',
    );
  });
});

describe('Land Explorer area unit toggle', () => {
  it('converts published acres and per-acre rates to true cent values', async () => {
    render(<LandExplorerView {...props} />);

    await waitFor(() => {
      expect(screen.getAllByText('Mallur').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('26.62 ac')).toBeInTheDocument();
    expect(screen.getByText('From, per acre')).toBeInTheDocument();
    expect(screen.getByText(/from ₹50\.5L\/ac/)).toBeInTheDocument();
    expect(screen.getByText(/Plot 1 · 0\.37 ac/)).toBeInTheDocument();
    expect(screen.getByText(/Plot 3 · 0\.206 ac/)).toBeInTheDocument();
    expect(screen.getByText('₹18.7L')).toBeInTheDocument();
    expect(screen.getByText('25.041 ac')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cent' }));

    expect(screen.getByText('2,662 cent')).toBeInTheDocument();
    expect(screen.getByText('From, per cent')).toBeInTheDocument();
    expect(screen.getByText(/from ₹50,514\/cent/)).toBeInTheDocument();
    expect(screen.getByText(/Plot 1 · 37 cent/)).toBeInTheDocument();
    expect(screen.getByText(/Plot 3 · 20\.6 cent/)).toBeInTheDocument();
    expect(screen.getByText('₹18.7L')).toBeInTheDocument();
    expect(screen.getByText('2,504.1 cent')).toBeInTheDocument();
    expect(screen.getByText('60.2 cent')).toBeInTheDocument();
    expect(screen.queryByText('26.62 ac')).not.toBeInTheDocument();
  });
});

describe('Land Explorer type facets', () => {
  it('shows the property difference as a desktop row tooltip', async () => {
    render(<LandExplorerView {...props} />);

    await waitFor(() => {
      expect(screen.getAllByText('Mallur').length).toBeGreaterThan(0);
    });

    expect(
      screen.queryByRole('button', { name: 'About property types' }),
    ).not.toBeInTheDocument();

    const help = screen.getByRole('button', {
      name: 'About Industrial plot',
    });
    fireEvent.mouseEnter(help);

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'no building is implied',
    );

    fireEvent.mouseLeave(help);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('filters estates by published unit type and can clear', async () => {
    render(<LandExplorerView {...props} />);

    await waitFor(() => {
      expect(screen.getAllByText('Mallur').length).toBeGreaterThan(0);
    });

    expect(
      screen.getByRole('checkbox', { name: /Industrial plot/ }),
    ).not.toBeChecked();
    expect(
      screen
        .getByRole('checkbox', { name: /Industrial plot/ })
        .closest('label'),
    ).toHaveTextContent('2');
    expect(
      screen.getByRole('checkbox', { name: /Module/ }).closest('label'),
    ).toHaveTextContent('3');
    expect(screen.getByText('Mettur')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /Module/ }));

    expect(screen.getByRole('checkbox', { name: /Module/ })).toBeChecked();
    expect(screen.queryByText('Mallur')).not.toBeInTheDocument();
    expect(screen.getAllByText('Mettur').length).toBeGreaterThan(0);
    expect(screen.getByText(/Module A1/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByRole('checkbox', { name: /Module/ })).not.toBeChecked();
    expect(screen.getAllByText('Mallur').length).toBeGreaterThan(0);
  });
});
