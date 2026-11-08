import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  CreditCardIcon,
  DeliveryTruck01Icon,
  Location01Icon,
  Motorbike01Icon,
  Notification01Icon,
  PackageIcon,
  Store01Icon,
  WarehouseIcon,
} from '@hugeicons/core-free-icons'
import type { IconName } from './types'

// Must match IconName in backend/app/models.py. The server only ever sends these keys.
const ICONS: Record<IconName, typeof PackageIcon> = {
  package: PackageIcon,
  store: Store01Icon,
  warehouse: WarehouseIcon,
  truck: DeliveryTruck01Icon,
  rider: Motorbike01Icon,
  clock: Clock01Icon,
  location: Location01Icon,
  alert: Alert02Icon,
  delivered: CheckmarkCircle02Icon,
  payment: CreditCardIcon,
  cancel: Cancel01Icon,
  bell: Notification01Icon,
}

export function NotificationIcon({ name, size = 22, className }: { name: string | null | undefined; size?: number; className?: string }) {
  const icon = ICONS[name as IconName] ?? Notification01Icon
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.8} className={className} aria-hidden="true" />
}
