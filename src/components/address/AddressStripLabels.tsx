import { useHasSelectedDeliveryAddress, useSelectedAddressSnapshot } from "@/hooks/useSelectedAddressLine";
import { ADD_DELIVERY_ADDRESS_PROMPT } from "@/constants/selectedAddressStorage";

type PipeLayout = Readonly<{
  layout: "pipe";
  /** @deprecated Ignored for display; kept for call-site compatibility. */
  addrRaw?: string;
  titleClassName: string;
  sepClassName: string;
  addrClassName: string;
  promptClassName?: string;
}>;

type StackLayout = Readonly<{
  layout: "stack";
  /** @deprecated Ignored for display; kept for call-site compatibility. */
  addrRaw?: string;
  titleClassName: string;
  addrClassName: string;
  promptClassName?: string;
}>;

export type AddressStripLabelsProps = PipeLayout | StackLayout;

/**
 * Top-bar copy from {@link readSelectedAddress} only — never appointment or demo text.
 * Shows {@link ADD_DELIVERY_ADDRESS_PROMPT} when the user has no saved delivery address.
 */
export function AddressStripLabels(props: AddressStripLabelsProps) {
  const snap = useSelectedAddressSnapshot();
  const hasSaved = useHasSelectedDeliveryAddress();
  const promptCn = props.promptClassName ?? props.addrClassName;
  const displayLine = snap?.displayLine?.trim() ?? "";

  if (!hasSaved || !displayLine) {
    return <span className={promptCn}>{ADD_DELIVERY_ADDRESS_PROMPT}</span>;
  }

  const tag = snap?.tag?.trim() ? snap.tag.toUpperCase() : "HOME";

  if (props.layout === "pipe") {
    return (
      <>
        <span className={props.titleClassName}>{tag}</span>
        <span className={props.sepClassName} aria-hidden>
          |
        </span>
        <span className={props.addrClassName}>{displayLine}</span>
      </>
    );
  }

  return (
    <>
      <span className={props.titleClassName}>{tag}</span>
      <span className={props.addrClassName}>{displayLine}</span>
    </>
  );
}
