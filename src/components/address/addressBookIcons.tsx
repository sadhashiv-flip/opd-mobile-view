import {
  MdAdd,
  MdLocationOn,
  MdOutlineBusiness,
  MdOutlineDeleteOutline,
  MdOutlineEdit,
  MdOutlineHome,
  MdOutlineLocationOn,
  MdOutlineStar,
  MdVerified,
} from "react-icons/md";

/** Flutter `AddressBookScreen._AddressCard._iconForTag` */
export function AddressTagIcon({
  tag,
  size = 20,
}: Readonly<{ tag: string; size?: number }>) {
  const t = tag.trim().toUpperCase();
  if (t === "HOME") return <MdOutlineHome size={size} aria-hidden />;
  if (t === "WORK") return <MdOutlineBusiness size={size} aria-hidden />;
  return <MdOutlineLocationOn size={size} aria-hidden />;
}

/** Flutter empty illustration — `Icons.location_on_rounded` */
export function AddressEmptyPinIcon({ size = 36 }: Readonly<{ size?: number }>) {
  return <MdLocationOn size={size} aria-hidden />;
}

/** Flutter `_buildAddAddressChip` / `_buildAddNewButton` — `Icons.add_rounded` */
export function AddressAddIcon({ size = 20 }: Readonly<{ size?: number }>) {
  return <MdAdd size={size} aria-hidden />;
}

/** Flutter `_ActionChip` — `Icons.star_outline_rounded` (Set Primary, non-primary only) */
export function AddressSetPrimaryIcon({ size = 14 }: Readonly<{ size?: number }>) {
  return <MdOutlineStar size={size} aria-hidden />;
}

/** Flutter `_ActionChip` — `Icons.edit_outlined` */
export function AddressEditIcon({ size = 14 }: Readonly<{ size?: number }>) {
  return <MdOutlineEdit size={size} aria-hidden />;
}

/** Flutter `_ActionChip` — `Icons.delete_outline_rounded` */
export function AddressDeleteIcon({ size = 14 }: Readonly<{ size?: number }>) {
  return <MdOutlineDeleteOutline size={size} aria-hidden />;
}

/** Flutter primary card actions — `Icons.verified_rounded` (primary only) */
export function AddressVerifiedIcon({ size = 20 }: Readonly<{ size?: number }>) {
  return <MdVerified size={size} aria-hidden />;
}
