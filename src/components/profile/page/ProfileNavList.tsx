import { Link } from "react-router-dom";

export type ProfileNavItem = Readonly<{
  key: string;
  title: string;
  to?: string;
  onClick?: () => void;
  iconSrc: string;
}>;

type ProfileNavListProps = Readonly<{
  items: readonly ProfileNavItem[];
}>;

function ProfileNavRow({
  item,
}: Readonly<{
  item: ProfileNavItem;
}>) {
  const content = (
    <>
      <span className="profile-page__nav-icon" aria-hidden>
        <img src={item.iconSrc} alt="" width={20} height={20} draggable={false} />
      </span>
      <span className="profile-page__nav-title">{item.title}</span>
      <span className="profile-page__nav-chevron" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </>
  );

  if (item.to) {
    return (
      <li>
        <Link to={item.to} className="profile-page__nav-row">
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button type="button" className="profile-page__nav-row" onClick={item.onClick}>
        {content}
      </button>
    </li>
  );
}

export function ProfileNavList({ items }: ProfileNavListProps) {
  if (items.length === 0) return null;
  return (
    <ul className="profile-page__nav-list" role="list">
      {items.map((item) => (
        <ProfileNavRow key={item.key} item={item} />
      ))}
    </ul>
  );
}
