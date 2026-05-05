import { useSelectedAddressSnapshot } from "@/hooks/useSelectedAddressLine";
import { ADD_DELIVERY_ADDRESS_PROMPT } from "@/constants/selectedAddressStorage";

type PipeLayout = Readonly<{
  layout: "pipe";
  addrRaw: string;
  titleClassName: string;
  sepClassName: string;
  addrClassName: string;
  promptClassName?: string;
}>;

type StackLayout = Readonly<{
  layout: "stack";
  addrRaw: string;
  titleClassName: string;
  addrClassName: string;
  promptClassName?: string;
}>;

export type AddressStripLabelsProps = PipeLayout | StackLayout;

/**
 * Renders tag | line from {@link readSelectedAddress} when {@link addrRaw} is non-empty;
 * otherwise shows {@link ADD_DELIVERY_ADDRESS_PROMPT} (no static demo addresses).
 */
export function AddressStripLabels(props: AddressStripLabelsProps) {
  const has = props.addrRaw.trim().length > 0;
  const snap = useSelectedAddressSnapshot();
  const promptCn = props.promptClassName ?? props.addrClassName;

  if (!has) {
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
        <span className={props.addrClassName}>{props.addrRaw}</span>
      </>
    );
  }

  return (
    <>
      <span className={props.titleClassName}>{tag}</span>
      <span className={props.addrClassName}>{props.addrRaw}</span>
    </>
  );
}
