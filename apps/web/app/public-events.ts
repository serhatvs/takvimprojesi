import { DEFAULT_TIME_ZONE, getApiBaseUrl } from "@agu/config";
import type {
  PublicEventDetailResponse,
  PublicEventListItem,
  PublicEventListResponse
} from "@agu/contracts";

export const PUBLIC_EVENTS_PAGE_SIZE = 12;

export type RawSearchParams = Record<string, string | string[] | undefined>;

export type PublicEventFilters = {
  q: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
};

export type PublicEventsQueryResult =
  | {
      ok: true;
      filters: PublicEventFilters;
      apiPath: string;
    }
  | {
      ok: false;
      filters: PublicEventFilters;
      message: string;
    };

export type PublicEventsLoadResult =
  | {
      status: "success";
      filters: PublicEventFilters;
      data: PublicEventListResponse;
    }
  | {
      status: "validation-error";
      filters: PublicEventFilters;
      message: string;
    }
  | {
      status: "api-error";
      filters: PublicEventFilters;
      message: string;
    };

export type PublicEventDetailLoadResult =
  | {
      status: "success";
      event: PublicEventDetailResponse;
    }
  | {
      status: "not-found";
    }
  | {
      status: "api-error";
      message: string;
    };

export type EventCardViewModel = {
  id: string;
  title: string;
  clubName: string;
  startsAt: string;
  endsAt: string;
  location: string;
  description: string;
  capacityLabel: string | null;
  statusLabel: "Yayinda";
};

export type EventDetailViewModel = {
  id: string;
  title: string;
  clubName: string;
  startsAt: string;
  endsAt: string;
  location: string;
  description: string;
  capacityLabel: string | null;
  publishedAtLabel: string | null;
  statusLabel: "Yayinda";
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: DEFAULT_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parsePositivePage(value: string): number {
  if (!value) {
    return 1;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    return 1;
  }

  return Number(value);
}

function parsePositivePageSize(value: string): number {
  if (!value) {
    return PUBLIC_EVENTS_PAGE_SIZE;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    return PUBLIC_EVENTS_PAGE_SIZE;
  }

  return Number(value);
}

function isValidDateInput(value: string): boolean {
  if (!value) {
    return true;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00+03:00`);
  return !Number.isNaN(parsed.getTime());
}

function dateInputToIsoStart(value: string): string {
  return new Date(`${value}T00:00:00+03:00`).toISOString();
}

function dateInputToIsoEnd(value: string): string {
  return new Date(`${value}T23:59:59.999+03:00`).toISOString();
}

export function parsePublicEventFilters(searchParams: RawSearchParams): PublicEventFilters {
  return {
    q: firstValue(searchParams.q).trim(),
    from: firstValue(searchParams.from).trim(),
    to: firstValue(searchParams.to).trim(),
    page: parsePositivePage(firstValue(searchParams.page).trim()),
    pageSize: parsePositivePageSize(firstValue(searchParams.pageSize).trim())
  };
}

export function buildPublicEventsApiPath(filters: PublicEventFilters): PublicEventsQueryResult {
  if (!isValidDateInput(filters.from) || !isValidDateInput(filters.to)) {
    return {
      ok: false,
      filters,
      message: "Tarih filtreleri gecerli bir gun biciminde olmalidir."
    };
  }

  if (filters.from && filters.to && dateInputToIsoStart(filters.from) > dateInputToIsoEnd(filters.to)) {
    return {
      ok: false,
      filters,
      message: "Baslangic tarihi bitis tarihinden sonra olamaz."
    };
  }

  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.from) {
    params.set("from", dateInputToIsoStart(filters.from));
  }

  if (filters.to) {
    params.set("to", dateInputToIsoEnd(filters.to));
  }

  return {
    ok: true,
    filters,
    apiPath: `/events?${params.toString()}`
  };
}

export function buildPublicEventsPageHref(filters: PublicEventFilters, page: number): string {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.from) {
    params.set("from", filters.from);
  }

  if (filters.to) {
    params.set("to", filters.to);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  if (filters.pageSize !== PUBLIC_EVENTS_PAGE_SIZE) {
    params.set("pageSize", String(filters.pageSize));
  }

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function buildPublicEventDetailHref(
  eventId: string,
  filters: PublicEventFilters
): string {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.from) {
    params.set("from", filters.from);
  }

  if (filters.to) {
    params.set("to", filters.to);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  params.set("pageSize", String(filters.pageSize));

  const query = params.toString();
  return `/events/${encodeURIComponent(eventId)}${query ? `?${query}` : ""}`;
}

export function buildPublicEventsReturnHref(searchParams: RawSearchParams): string {
  const filters = parsePublicEventFilters(searchParams);
  return buildPublicEventsPageHref(filters, filters.page);
}

export function formatEventDateTime(isoValue: string): string {
  return dateFormatter.format(new Date(isoValue));
}

export function toEventCardViewModel(event: PublicEventListItem): EventCardViewModel {
  return {
    id: event.id,
    title: event.title,
    clubName: event.club.name,
    startsAt: formatEventDateTime(event.startsAt),
    endsAt: formatEventDateTime(event.endsAt),
    location: event.location,
    description: event.description,
    capacityLabel: event.capacity === null ? null : `${event.capacity} kisilik kapasite`,
    statusLabel: "Yayinda"
  };
}

export function toEventDetailViewModel(event: PublicEventDetailResponse): EventDetailViewModel {
  return {
    id: event.id,
    title: event.title,
    clubName: event.club.name,
    startsAt: formatEventDateTime(event.startsAt),
    endsAt: formatEventDateTime(event.endsAt),
    location: event.location,
    description: event.description,
    capacityLabel: event.capacity === null ? null : `${event.capacity} kisilik kapasite`,
    publishedAtLabel: event.publishedAt ? formatEventDateTime(event.publishedAt) : null,
    statusLabel: "Yayinda"
  };
}

export function createEventMetadataDescription(description: string): string {
  const normalized = description.replace(/\s+/g, " ").trim();
  const maxLength = 155;

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export async function loadPublicEventDetail(
  eventId: string
): Promise<PublicEventDetailLoadResult> {
  if (!eventId.trim()) {
    return { status: "not-found" };
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/events/${encodeURIComponent(eventId)}`, {
      cache: "no-store"
    });

    if (response.status === 404) {
      return { status: "not-found" };
    }

    if (!response.ok) {
      return {
        status: "api-error",
        message: "Etkinlik detayi su anda alinamiyor."
      };
    }

    return {
      status: "success",
      event: (await response.json()) as PublicEventDetailResponse
    };
  } catch {
    return {
      status: "api-error",
      message: "API baglantisi kurulamadigi icin etkinlik detayi gosterilemiyor."
    };
  }
}

export async function loadPublicEvents(
  searchParams: RawSearchParams
): Promise<PublicEventsLoadResult> {
  const filters = parsePublicEventFilters(searchParams);
  const query = buildPublicEventsApiPath(filters);

  if (!query.ok) {
    return {
      status: "validation-error",
      filters,
      message: query.message
    };
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${query.apiPath}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        status: "api-error",
        filters,
        message: "Etkinlik listesi su anda alinamiyor."
      };
    }

    return {
      status: "success",
      filters,
      data: (await response.json()) as PublicEventListResponse
    };
  } catch {
    return {
      status: "api-error",
      filters,
      message: "API baglantisi kurulamadigi icin etkinlikler gosterilemiyor."
    };
  }
}
