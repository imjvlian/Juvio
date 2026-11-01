import type { ComponentType } from "react";
import {
  BookOpenIcon,
  CheckCircleIcon,
  CheckSquareIcon,
  FileLinesIcon,
  HomeIcon,
  LibraryIcon,
  PageIcon,
  TargetIcon,
} from "./icons";

type GlyphComponent = ComponentType<{ width?: number; height?: number; className?: string }>;

/**
 * Named page icons are stored in `Page.icon` as stable keys (for example
 * `check-circle`) so the sidebar and Library table can render crisp SVG
 * glyphs. Anything else in that field is treated as an emoji from the picker.
 */
const GLYPHS: Record<string, GlyphComponent> = {
  home: HomeIcon,
  house: HomeIcon,
  homeorange: HomeIcon,
  check: CheckCircleIcon,
  checkcircle: CheckCircleIcon,
  checkbox: CheckSquareIcon,
  checksquare: CheckSquareIcon,
  target: TargetIcon,
  targetcircle: TargetIcon,
  book: BookOpenIcon,
  bookopen: BookOpenIcon,
  wiki: BookOpenIcon,
  meetings: FileLinesIcon,
  filelines: FileLinesIcon,
  file: PageIcon,
  filepage: PageIcon,
  docs: PageIcon,
  page: PageIcon,
  library: LibraryIcon,
};

function iconKey(icon: string): string {
  return icon.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function PageGlyph({
  icon,
  size = 16,
  className,
}: {
  icon: string | null;
  size?: number;
  className?: string;
}) {
  if (icon) {
    const Glyph = GLYPHS[iconKey(icon)];
    if (Glyph) return <Glyph width={size} height={size} className={className} />;
    return (
      <span
        className={className ? `page-glyph ${className}` : "page-glyph"}
        style={{ fontSize: Math.round(size * 0.95), lineHeight: 1 }}
        aria-hidden="true"
      >
        {icon}
      </span>
    );
  }
  return <PageIcon width={size} height={size} className={className} />;
}
