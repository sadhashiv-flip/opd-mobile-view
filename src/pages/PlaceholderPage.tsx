import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import "./HomePage.css";

type PlaceholderPageProps = Readonly<{
  title: string;
}>;

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="home-page">
      <main className="home-page__main home-page__main--placeholder">
        <p className="home-placeholder-title">{title}</p>
        <p className="home-placeholder-sub">Coming soon</p>
      </main>
      <HomeBottomNav />
    </div>
  );
}
