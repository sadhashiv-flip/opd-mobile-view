import type { ReactNode } from "react";

type ClaimBillFieldLabelProps = Readonly<{
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}>;

export function ClaimBillFieldLabel({ htmlFor, required, children }: ClaimBillFieldLabelProps) {
  return (
    <label className="pbf-label" htmlFor={htmlFor}>
      {children}
      {required ? (
        <span className="claim-req-star" aria-hidden="true">
          {" "}
          *
        </span>
      ) : null}
    </label>
  );
}

type ClaimBillUploadHeadingProps = Readonly<{
  required?: boolean;
  children: ReactNode;
}>;

export function ClaimBillUploadHeading({ required, children }: ClaimBillUploadHeadingProps) {
  return (
    <p className="claim-new-page__upload-heading">
      {children}
      {required ? (
        <span className="claim-req-star" aria-hidden="true">
          {" "}
          *
        </span>
      ) : null}
    </p>
  );
}
