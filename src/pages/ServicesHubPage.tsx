import { ServiceHubCard } from "@/components/services/ServiceHubCard";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import {
  getHubHeading,
  getHubItems,
  HUB_TABS,
  isHubTabId,
  type HubTabId,
} from "@/constants/servicesHubContent";
import { ROUTES } from "@/constants";
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "./ServicesHubPage.css";

function parseTab(raw: string | null): HubTabId {
  if (raw && isHubTabId(raw)) {
    return raw;
  }
  return "services";
}

export function ServicesHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabId = useMemo(
    () => parseTab(searchParams.get("tab")),
    [searchParams],
  );

  const navigate = useNavigate();

  const setTab = useCallback(
    (id: HubTabId) => {
      setSearchParams({ tab: id }, { replace: true });
    },
    [setSearchParams],
  );

  const items = getHubItems(tabId);
  const heading = getHubHeading(tabId);
  const gridCols = tabId === "opd-claims" ? 2 : 3;

  const [medicalSelectedId, setMedicalSelectedId] = useState("lab");

  return (
    <div className="services-hub">
      <header className="services-hub__top">
        <Link
          to={ROUTES.dashboard}
          className="services-hub__back"
          aria-label="Back to home"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <nav className="services-hub__tabs" aria-label="Service categories">
          {HUB_TABS.map(({ id, label, Icon, iconSrc }) => {
            const active = tabId === id;
            const TabIcon = Icon;
            return (
              <button
                key={id}
                type="button"
                className={`services-hub__tab${active ? " services-hub__tab--active" : ""}`}
                onClick={() => setTab(id)}
                aria-current={active ? "page" : undefined}
              >
                {iconSrc ? (
                  <img
                    src={iconSrc}
                    alt=""
                    width={24}
                    height={24}
                    draggable={false}
                    className="services-hub__tab-icon services-hub__tab-icon--asset"
                  />
                ) : TabIcon ? (
                  <TabIcon
                    aria-hidden="true"
                    className="services-hub__tab-icon"
                  />
                ) : null}
                <span className="services-hub__tab-label">{label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      <main className="services-hub__main">
        <h1 className="services-hub__title">{heading}</h1>
        <div
          className={`service-hub-grid service-hub-grid--cols-${gridCols}`}
        >
          {items.map((item) => {
            const Icon = item.Icon;
            const isMedical = tabId === "medical-records";
            const selected = isMedical && medicalSelectedId === item.id;

            const iconNode = item.iconSrc ? (
              <img
                src={item.iconSrc}
                alt=""
                className="service-hub-card__img-icon"
                width={22}
                height={22}
                draggable={false}
              />
            ) : Icon ? (
              <Icon aria-hidden />
            ) : null;

            return (
              <ServiceHubCard
                key={item.id}
                icon={iconNode}
                title={item.title}
                description={item.description}
                badge={item.badge}
                selected={selected}
                onClick={
                  tabId === "services" && item.id === "gym"
                    ? () => navigate(ROUTES.gymMembership)
                    : isMedical
                    ? () => setMedicalSelectedId(item.id)
                    : undefined
                }
              />
            );
          })}
        </div>
      </main>

      <HomeBottomNav />
    </div>
  );
}
