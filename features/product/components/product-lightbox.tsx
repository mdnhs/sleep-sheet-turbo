"use client";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/counter.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

interface ProductLightboxProps {
  index: number;
  slides: { src: string; title: string; description: string }[];
  open: boolean;
  close: () => void;
}

// Kept in its own chunk: switch-image loads this lazily so the lightbox
// library and its CSS stay out of the product page's initial bundle.
function ProductLightbox({ index, slides, open, close }: ProductLightboxProps) {
  return (
    <Lightbox
      index={index}
      slides={slides}
      open={open}
      close={close}
      plugins={[Captions, Counter, Fullscreen, Slideshow, Thumbnails, Zoom]}
      animation={{ zoom: 600 }}
      zoom={{
        maxZoomPixelRatio: 5,
        zoomInMultiplier: 2,
        scrollToZoom: true,
      }}
      render={{
        iconPrev: () => <IconChevronLeft className="size-6 text-white" />,
        iconNext: () => <IconChevronRight className="size-6 text-white" />,
        iconClose: () => <IconX className="size-6 text-white" />,
      }}
    />
  );
}

export default ProductLightbox;
