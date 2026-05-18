import { useState } from "react";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { AddressStripLabels } from "@/components/address/AddressStripLabels";
import { deliveryAddressChooserAriaLabel } from "@/constants/selectedAddressStorage";
import { useHasSelectedDeliveryAddress } from "@/hooks/useSelectedAddressLine";
import "./VaccinationAddressBar.css";

export function VaccinationAddressBar() {
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const hasDeliveryAddress = useHasSelectedDeliveryAddress();

  return (
    <>
      <button
        type="button"
        className="vac-flow-loc"
        aria-label={deliveryAddressChooserAriaLabel(hasDeliveryAddress)}
        onClick={() => setAddrSheetOpen(true)}
      >
        <span className="vac-flow-loc__pin" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 22s7-5.1 7-12a7 7 0 10-14 0c0 6.9 7 12 7 12z"
              fill="#FF541E"
            />
            <circle cx="12" cy="10" r="2.5" fill="#ffffff" opacity="0.95" />
          </svg>
        </span>
        <span className="vac-flow-loc__body">
          <AddressStripLabels
            layout="pipe"
            titleClassName="vac-flow-loc__title"
            sepClassName="vac-flow-loc__sep"
            addrClassName="vac-flow-loc__addr"
            promptClassName="vac-flow-loc__addr vac-flow-loc__addr--prompt"
          />
        </span>
        <span className="vac-flow-loc__chev" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      <AddressBottomSheet open={addrSheetOpen} onClose={() => setAddrSheetOpen(false)} />
    </>
  );
}
