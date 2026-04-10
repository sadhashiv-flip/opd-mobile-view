import "./NoticeCard.css";

export type NoticeCardProps = Readonly<{
  imageUrl: string | null;
  title: string | null;
  note: string;
  blockLogin: boolean;
  onContinueToLogin?: () => void;
  onSkipToLogin?: () => void;
}>;

export function NoticeCard({
  imageUrl,
  title,
  note,
  blockLogin,
  onContinueToLogin,
  onSkipToLogin,
}: NoticeCardProps) {
  return (
    <article className="notice-card">
      {imageUrl ? (
        <div className="notice-card__media">
          <img
            className="notice-card__img"
            src={imageUrl}
            alt=""
            decoding="async"
            loading="eager"
          />
        </div>
      ) : null}
      <div className="notice-card__body">
        {title ? (
          <h1 className="notice-card__title" id="prelogin-notice-title">
            {title}
          </h1>
        ) : null}
        {note ? (
          <p className="notice-card__note">{note}</p>
        ) : (
          <p className="notice-card__note notice-card__note--muted">No additional details.</p>
        )}
        <div className="notice-card__actions">
          {blockLogin ? (
            <button type="button" className="notice-card__btn notice-card__btn--primary">
              OK
            </button>
          ) : (
            <>
              <button
                type="button"
                className="notice-card__btn notice-card__btn--primary"
                onClick={onContinueToLogin}
              >
                Continue
              </button>
              <button
                type="button"
                className="notice-card__btn notice-card__btn--ghost"
                onClick={onSkipToLogin}
              >
                Skip
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
