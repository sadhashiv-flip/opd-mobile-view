import {
  MdOutlineEvent,
  MdOutlineLocationOn,
  MdOutlinePayments,
  MdOutlinePeople,
  MdOutlinePerson,
  MdOutlinePhone,
  MdOutlineSchedule,
  MdOutlineScience,
} from "react-icons/md";

const wrap = (node: React.ReactNode) => (
  <span className="lt-card__icon-svg" style={{ display: "flex" }} aria-hidden>
    {node}
  </span>
);

/** Flutter `HealthCheckupOverviewScreen._buildCard` icon set (Material outlined). */
export const DIAG_OVERVIEW_IC_LOCATION = wrap(<MdOutlineLocationOn size={18} />);
/** Lab overview contact card — `Icons.person_outline_rounded`. */
export const DIAG_OVERVIEW_IC_PERSON = wrap(<MdOutlinePerson size={18} />);
export const DIAG_OVERVIEW_IC_PEOPLE = wrap(<MdOutlinePeople size={18} />);
export const DIAG_OVERVIEW_IC_SCHEDULE = wrap(<MdOutlineSchedule size={18} />);
export const DIAG_OVERVIEW_IC_PHONE = wrap(<MdOutlinePhone size={18} />);
export const DIAG_OVERVIEW_IC_EVENT = wrap(<MdOutlineEvent size={16} />);
export const DIAG_OVERVIEW_IC_FLASK = wrap(<MdOutlineScience size={18} />);
export const DIAG_OVERVIEW_IC_PAY = wrap(<MdOutlinePayments size={18} />);
