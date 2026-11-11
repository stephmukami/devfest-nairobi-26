import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { STATUS_ICON } from '@/lib/format'
import { Icon, NotificationIcon } from '@/lib/icons'
import type { Parcel } from '@/lib/types'
import { cn } from '@/lib/utils'

// Product photos made from the JPGs in public/: 256px squares in public/items for lists,
// up to 1200px in public/items/large for the pop-out. Parcels without a photo show their status icon.
const ITEM_IMAGE: Record<string, string> = {
  'Woven basket': 'basket',
  'Bedsheet set': 'bedsheets',
  Blender: 'blender',
  'Coffee beans': 'coffee-beans',
  Cookbook: 'cookbook',
  'Linen shirt': 'linen-shirt',
  'Phone case': 'phone-case',
  'Running shoes': 'running-shoes',
  'Spice set': 'spice-rack',
  Storybook: 'storybook',
  'Table lamp': 'table-lamp',
}

const SIZES = {
  sm: { box: 'size-11', icon: 22 },
  lg: { box: 'size-16 sm:size-20', icon: 30 },
}

/**
 * Product photo (or status icon). Clicking a photo opens it large.
 * Inside a clickable card, give the card's own button a stretched overlay and leave this above it
 * (it is `relative z-10`), so the photo and the card are separate buttons.
 */
export function ParcelThumb({ parcel, size = 'sm', className }: { parcel: Parcel; size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size]
  const image = ITEM_IMAGE[parcel.item]

  if (!image) {
    return (
      <span className={cn('grid flex-none place-items-center rounded-lg border bg-muted/50 text-foreground/80', s.box, className)}>
        <NotificationIcon name={STATUS_ICON[parcel.status] ?? 'package'} size={s.icon} />
      </span>
    )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className={cn(
            'relative z-10 flex-none cursor-zoom-in overflow-hidden rounded-lg border bg-muted transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            s.box,
            className,
          )}
          aria-label={`View photo of ${parcel.item}`}
        >
          <img src={`/items/${image}.webp`} alt="" loading="lazy" className="size-full object-cover" />
        </button>
      </DialogTrigger>
      {/* Full width on phones; on larger screens the dialog hugs the photo. */}
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100vw-2rem)] max-w-none gap-3 rounded-lg p-3 sm:w-auto sm:max-w-[min(90vw,56rem)]"
      >
        <div className="relative">
          <img
            src={`/items/large/${image}.webp`}
            alt={parcel.item}
            className="mx-auto max-h-[75vh] w-full rounded-md bg-muted object-contain sm:w-auto"
          />
          {/* White round button so it shows on dark and light photos alike. */}
          <DialogClose asChild>
            <Button
              variant="secondary"
              size="icon-sm"
              className="absolute top-2 right-2 rounded-full bg-card/90 shadow-md hover:bg-card"
              aria-label="Close"
            >
              <Icon name="close" size={16} />
            </Button>
          </DialogClose>
        </div>
        <div className="px-1 pb-1">
          <DialogTitle className="font-semibold">{parcel.item}</DialogTitle>
          <DialogDescription>
            {parcel.store} · {parcel.parcel_id}
          </DialogDescription>
        </div>
      </DialogContent>
    </Dialog>
  )
}
