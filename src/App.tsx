import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  FilterX,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const API_BASE = "https://feriados-red.vercel.app";

type HolidayScope = "national" | "regional" | "municipal";

type Holiday = {
  date: string;
  name: string;
  scope: HolidayScope;
  region: string | null;
  district: string | null;
  municipality: string | null;
  sources: string[];
  verification_status: string;
  confidence: number;
};

type Region = {
  region: string;
  type: string;
  available_years: string;
  holidays: Array<{
    name: string;
    start_year: number;
    sources: string[];
    verification_status: string;
    confidence: number;
  }>;
};

type Municipality = {
  municipality: string;
  district: string;
  holiday_name: string;
  available_years: number[];
  sources: string[];
  verification_status: string;
  confidence: number;
};

type District = {
  district: string;
  municipality_count: number;
  municipality_names: string[];
  available_years: number[];
};

type Source = {
  id: string;
  name: string;
  url: string;
};

type Coverage = {
  municipal_years: number[];
  municipalities: number;
};

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const weekdayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

const scopeLabels: Record<HolidayScope, string> = {
  national: "Nacional",
  regional: "Regional",
  municipal: "Municipal",
};

const today = new Date();

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function getCalendarCells(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const leadingEmptyCells = (firstDay + 6) % 7;
  const cells: Array<number | null> = Array.from({ length: leadingEmptyCells }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function getInitialMonth() {
  const month = Number(new URLSearchParams(window.location.search).get("month"));
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month - 1 : today.getMonth();
}

function getInitialYear() {
  const year = Number(new URLSearchParams(window.location.search).get("year"));
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : today.getFullYear();
}

function getInitialParam(name: string) {
  return new URLSearchParams(window.location.search).get(name) ?? "";
}

function holidayKey(holiday: Holiday) {
  return [
    holiday.date,
    holiday.scope,
    holiday.name,
    holiday.region ?? "",
    holiday.district ?? "",
    holiday.municipality ?? "",
  ].join("|");
}

export function App() {
  const [year, setYear] = useState(getInitialYear);
  const [month, setMonth] = useState(getInitialMonth);
  const [selectedDistrict, setSelectedDistrict] = useState(
    getInitialParam("district") || getInitialParam("region"),
  );
  const [selectedMunicipality, setSelectedMunicipality] = useState(getInitialParam("municipality"));
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [loading, setLoading] = useState(true);
  const [holidayLoading, setHolidayLoading] = useState(true);
  const [error, setError] = useState("");

  const years = useMemo(() => {
    const coverageYears = coverage?.municipal_years ?? [];
    const set = new Set([...coverageYears, year]);
    return Array.from(set).sort((a, b) => a - b);
  }, [coverage, year]);

  const sourceMap = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const regionalDistricts = useMemo(() => new Set(regions.map((region) => region.region)), [regions]);

  const filteredMunicipalities = useMemo(
    () =>
      selectedDistrict
        ? municipalities.filter((municipality) => municipality.district === selectedDistrict)
        : municipalities,
    [municipalities, selectedDistrict],
  );

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams({ year: String(year) });
    if (selectedDistrict) {
      params.set("district", selectedDistrict);
      if (regionalDistricts.has(selectedDistrict)) {
        params.set("region", selectedDistrict);
      }
    }
    if (selectedMunicipality) params.set("municipality", selectedMunicipality);
    return `${API_BASE}/holidays?${params}`;
  }, [year, selectedDistrict, selectedMunicipality, regionalDistricts]);

  useEffect(() => {
    async function loadDiscovery() {
      try {
        setLoading(true);
        const [regionsResponse, districtsResponse, municipalitiesResponse, sourcesResponse, coverageResponse] =
          await Promise.all([
            fetch(`${API_BASE}/regions`),
            fetch(`${API_BASE}/districts`),
            fetch(`${API_BASE}/municipalities`),
            fetch(`${API_BASE}/sources`),
            fetch(`${API_BASE}/coverage`),
          ]);

        if (
          !regionsResponse.ok ||
          !districtsResponse.ok ||
          !municipalitiesResponse.ok ||
          !sourcesResponse.ok ||
          !coverageResponse.ok
        ) {
          throw new Error("Nao foi possivel carregar os dados da API.");
        }

        setRegions(await regionsResponse.json());
        setDistricts(await districtsResponse.json());
        setMunicipalities(await municipalitiesResponse.json());
        setSources(await sourcesResponse.json());
        setCoverage(await coverageResponse.json());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
      } finally {
        setLoading(false);
      }
    }

    loadDiscovery();
  }, []);

  useEffect(() => {
    async function loadHolidays() {
      try {
        setHolidayLoading(true);
        setError("");
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error("Nao existem feriados para os filtros selecionados.");
        }
        const data = (await response.json()) as Holiday[];
        setHolidays(data);
        setSelectedHoliday((current) =>
          current && data.some((holiday) => holidayKey(holiday) === holidayKey(current))
            ? current
            : null,
        );
      } catch (loadError) {
        setHolidays([]);
        setSelectedHoliday(null);
        setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
      } finally {
        setHolidayLoading(false);
      }
    }

    loadHolidays();
  }, [apiUrl]);

  useEffect(() => {
    const params = new URLSearchParams({ year: String(year), month: String(month + 1) });
    if (selectedDistrict) params.set("district", selectedDistrict);
    if (selectedMunicipality) params.set("municipality", selectedMunicipality);
    window.history.replaceState(null, "", `?${params}`);
  }, [year, month, selectedDistrict, selectedMunicipality]);

  useEffect(() => {
    if (!selectedDistrict || !selectedMunicipality) return;
    const municipalityStillAvailable = municipalities.some(
      (municipality) =>
        municipality.municipality === selectedMunicipality &&
        municipality.district === selectedDistrict,
    );
    if (!municipalityStillAvailable) {
      setSelectedMunicipality("");
    }
  }, [municipalities, selectedDistrict, selectedMunicipality]);

  const cells = useMemo(() => getCalendarCells(year, month), [year, month]);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, Holiday[]>();
    for (const holiday of holidays) {
      const items = map.get(holiday.date) ?? [];
      items.push(holiday);
      map.set(holiday.date, items);
    }
    return map;
  }, [holidays]);

  const monthHolidays = useMemo(
    () =>
      holidays
        .filter((holiday) => {
          const [, holidayMonth] = holiday.date.split("-").map(Number);
          return holidayMonth === month + 1;
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
    [holidays, month],
  );

  const selectedMunicipalityDetails = municipalities.find(
    (item) =>
      item.municipality === selectedMunicipality &&
      (!selectedDistrict || item.district === selectedDistrict),
  );

  function moveMonth(direction: -1 | 1) {
    const next = new Date(year, month + direction, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  function resetFilters() {
    setSelectedDistrict("");
    setSelectedMunicipality("");
  }

  return (
    <main className="shell">
      <section className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <CalendarDays size={24} />
          </div>
          <div>
            <p className="eyebrow">Portugal</p>
            <h1>Feriados</h1>
          </div>
        </div>

        <div className="status-strip">
          <span>{coverage?.municipalities ?? 308} concelhos</span>
          <span>{districts.length || 20} territorios</span>
          <a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer">
            API <ExternalLink size={14} />
          </a>
        </div>
      </section>

      <section className="toolbar" aria-label="Filtros">
        <label>
          Ano
          <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          Mes
          <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
            {monthNames.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Distrito/Regiao
          <select value={selectedDistrict} onChange={(event) => setSelectedDistrict(event.target.value)}>
            <option value="">Todas</option>
            {districts.map((district) => (
              <option key={district.district} value={district.district}>
                {district.district}
              </option>
            ))}
          </select>
        </label>

        <label className="municipality-filter">
          Concelho
          <span className="search-box">
            <Search size={16} />
            <input
              list="municipalities"
              value={selectedMunicipality}
              onChange={(event) => setSelectedMunicipality(event.target.value)}
              placeholder="Pesquisar"
            />
          </span>
          <datalist id="municipalities">
            {filteredMunicipalities.map((municipality) => (
              <option
                key={`${municipality.municipality}-${municipality.district}`}
                value={municipality.municipality}
              >
                {municipality.district}
              </option>
            ))}
          </datalist>
        </label>

        <button className="icon-button" type="button" onClick={resetFilters} aria-label="Limpar filtros">
          <FilterX size={18} />
        </button>
      </section>

      {error && (
        <section className="notice" role="alert">
          <CircleHelp size={18} />
          <span>{error}</span>
        </section>
      )}

      <section className="workspace">
        <div className="calendar-panel">
          <div className="calendar-heading">
            <button className="icon-button" type="button" onClick={() => moveMonth(-1)} aria-label="Mes anterior">
              <ChevronLeft size={20} />
            </button>
            <div>
              <h2>
                {monthNames[month]} {year}
              </h2>
              <p>{holidayLoading ? "A atualizar" : `${monthHolidays.length} feriados no mes`}</p>
            </div>
            <button className="icon-button" type="button" onClick={() => moveMonth(1)} aria-label="Mes seguinte">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="legend" aria-label="Legenda">
            {Object.entries(scopeLabels).map(([scope, label]) => (
              <span key={scope} className={`legend-item ${scope}`}>
                {label}
              </span>
            ))}
          </div>

          <div className="calendar-grid">
            {weekdayNames.map((weekday) => (
              <div className="weekday" key={weekday}>
                {weekday}
              </div>
            ))}

            {cells.map((day, index) => {
              const date = day ? isoDate(year, month, day) : "";
              const dayHolidays = day ? holidaysByDate.get(date) ?? [] : [];
              const isToday =
                day &&
                today.getFullYear() === year &&
                today.getMonth() === month &&
                today.getDate() === day;

              return (
                <button
                  className={`day-cell ${day ? "" : "empty"} ${isToday ? "today" : ""} ${
                    dayHolidays.length ? "has-holiday" : ""
                  }`}
                  key={`${index}-${day ?? "empty"}`}
                  type="button"
                  disabled={!day}
                  onClick={() => dayHolidays[0] && setSelectedHoliday(dayHolidays[0])}
                >
                  {day && <span className="day-number">{day}</span>}
                  <span className="holiday-stack">
                    {dayHolidays.slice(0, 2).map((holiday) => (
                      <span className={`holiday-pill ${holiday.scope}`} key={holidayKey(holiday)}>
                        {holiday.name}
                      </span>
                    ))}
                    {dayHolidays.length > 2 && <span className="more-pill">+{dayHolidays.length - 2}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="side-panel">
          <div className="panel-section">
            <div className="section-title">
              <MapPin size={18} />
              <h2>Feriados do mes</h2>
            </div>

            {loading || holidayLoading ? (
              <div className="loading">
                <RefreshCw size={18} />
                <span>A carregar</span>
              </div>
            ) : monthHolidays.length ? (
              <div className="holiday-list">
                {monthHolidays.map((holiday) => (
                  <button
                    className={`holiday-row ${holiday.scope}`}
                    key={holidayKey(holiday)}
                    type="button"
                    onClick={() => setSelectedHoliday(holiday)}
                  >
                    <span>{formatDate(holiday.date)}</span>
                    <strong>{holiday.name}</strong>
                    <em>{scopeLabels[holiday.scope]}</em>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">Sem feriados neste mes.</p>
            )}
          </div>

          <div className="panel-section details-section">
            <div className="section-title">
              <ShieldCheck size={18} />
              <h2>Detalhe</h2>
            </div>

            {selectedHoliday ? (
              <div className="detail">
                <span className={`scope-badge ${selectedHoliday.scope}`}>
                  {scopeLabels[selectedHoliday.scope]}
                </span>
                <h3>{selectedHoliday.name}</h3>
                <p>{formatDate(selectedHoliday.date)}</p>
                {(selectedHoliday.region || selectedHoliday.municipality) && (
                  <p className="muted">
                    {selectedHoliday.region}
                    {selectedHoliday.municipality}
                  </p>
                )}
                <dl>
                  <div>
                    <dt>Estado</dt>
                    <dd>{selectedHoliday.verification_status}</dd>
                  </div>
                  <div>
                    <dt>Confianca</dt>
                    <dd>{Math.round(selectedHoliday.confidence * 100)}%</dd>
                  </div>
                </dl>

                <button className="link-button" type="button" onClick={() => setShowSources((value) => !value)}>
                  {showSources ? "Ocultar fontes" : "Ver fontes"}
                </button>

                {showSources && (
                  <div className="sources-list">
                    {selectedHoliday.sources.map((sourceId) => {
                      const source = sourceMap.get(sourceId);
                      return (
                        <a key={sourceId} href={source?.url ?? "#"} target="_blank" rel="noreferrer">
                          {source?.name ?? sourceId}
                          <ExternalLink size={14} />
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className="muted">Seleciona um feriado.</p>
            )}
          </div>

          {selectedMunicipalityDetails && (
            <div className="panel-section compact">
              <h2>{selectedMunicipalityDetails.municipality}</h2>
              <p>{selectedMunicipalityDetails.holiday_name}</p>
              <span>{selectedMunicipalityDetails.district}</span>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
