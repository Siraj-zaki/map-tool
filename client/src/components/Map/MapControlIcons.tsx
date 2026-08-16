/**
 * Inline SVG icons for the floating map controls (Fullscreen, Locate Me).
 *
 * Why inline instead of loading the raw SVG via `<img>`: the original assets
 * bake the button chrome (rounded rectangle background + border) into the
 * SVG itself with hardcoded teal colors. Rendering them as `<img>` prevents
 * white-label recoloring of the background chrome; using `mask-image` loses
 * the distinction between chrome and glyph. Inline SVG lets us route the
 * chrome fills through the brand CSS variables while keeping the white
 * glyph as-is.
 *
 * Colors used:
 *  - Background rectangle: mix of `--brand-primary` and near-black (matches
 *    `.brand-panel-bg-strong`).
 *  - Border stroke: mix of `--brand-primary` and a dark neutral (matches
 *    `.brand-panel-border`).
 *  - Glyph: stays white so it reads on any brand hue.
 */

interface IconProps {
  className?: string;
  size?: number;
}

// Reused between both icons — keeps the source of truth in one place.
const CHROME_FILL =
  'color-mix(in srgb, var(--brand-primary, #088D95) 20%, #050a0c)';
const CHROME_STROKE =
  'color-mix(in srgb, var(--brand-primary, #088D95) 35%, #101820)';

export function FullscreenToolIcon({ className, size = 64 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g filter="url(#fs-shadow)">
        <rect
          x={7}
          y={5}
          width={50}
          height={50}
          rx={18}
          style={{ fill: CHROME_FILL }}
        />
        <rect
          x={7.5}
          y={5.5}
          width={49}
          height={49}
          rx={17.5}
          style={{ stroke: CHROME_STROKE }}
        />
      </g>
      <g clipPath="url(#fs-clip)">
        <path
          d="M24.5405 33.3514V36.6892C24.5405 37.1146 24.8854 37.4594 25.3108 37.4594H28.6487V39H25.3108C24.0346 39 23 37.9654 23 36.6892V33.3514H24.5405ZM42 33.3514V36.6892C42 37.9654 40.9654 39 39.6892 39H36.3514V37.4594H39.6892C40.1146 37.4594 40.4594 37.1146 40.4594 36.6892V33.3514H42ZM32.5 25.3919C34.7688 25.3919 36.6082 27.2312 36.6082 29.5C36.6082 31.7688 34.7688 33.6082 32.5 33.6082C30.2312 33.6082 28.3919 31.7688 28.3919 29.5C28.3919 27.2312 30.2312 25.3919 32.5 25.3919ZM39.6892 20C40.9654 20 42 21.0346 42 22.3108V25.6487H40.4594V22.3108C40.4594 21.8854 40.1146 21.5405 39.6892 21.5405H36.3514V20H39.6892ZM28.6487 20V21.5405H25.3108C24.8854 21.5405 24.5405 21.8854 24.5405 22.3108V25.6487H23V22.3108C23 21.0346 24.0346 20 25.3108 20H28.6487Z"
          fill="white"
        />
      </g>
      <defs>
        <filter
          id="fs-shadow"
          x={0}
          y={0}
          width={64}
          height={64}
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy={2} />
          <feGaussianBlur stdDeviation={3.5} />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1"
            result="shape"
          />
        </filter>
        <clipPath id="fs-clip">
          <rect
            width={19}
            height={19}
            fill="white"
            transform="translate(23 20)"
          />
        </clipPath>
      </defs>
    </svg>
  );
}

export function LocationToolIcon({ className, size = 64 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g filter="url(#loc-shadow)">
        <rect
          x={7}
          y={5}
          width={50}
          height={50}
          rx={18}
          style={{ fill: CHROME_FILL }}
        />
        <rect
          x={7.5}
          y={5.5}
          width={49}
          height={49}
          rx={17.5}
          style={{ stroke: CHROME_STROKE }}
        />
      </g>
      <path
        d="M25.3633 30.0523C24.0108 29.5711 23.3346 29.3304 23.1331 28.9655C22.9585 28.6492 22.9503 28.2673 23.1112 27.9439C23.2969 27.5706 23.9623 27.3013 25.293 26.7627L37.8356 21.6859C39.1461 21.1555 39.8014 20.8902 40.2154 21.0262C40.5747 21.1443 40.8565 21.4261 40.9746 21.7854C41.1106 22.1994 40.8453 22.8546 40.3149 24.1652L35.2381 36.7078C34.6995 38.0385 34.4302 38.7039 34.0569 38.8896C33.7335 39.0505 33.3516 39.0423 33.0353 38.8677C32.6704 38.6662 32.4297 37.99 31.9485 36.6375L30.4751 32.4967C30.3815 32.2336 30.3347 32.102 30.2582 31.9922C30.1905 31.8948 30.106 31.8103 30.0086 31.7426C29.8988 31.6661 29.7672 31.6193 29.5041 31.5257L25.3633 30.0523Z"
        stroke="white"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <filter
          id="loc-shadow"
          x={0}
          y={0}
          width={64}
          height={64}
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy={2} />
          <feGaussianBlur stdDeviation={3.5} />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1"
            result="shape"
          />
        </filter>
      </defs>
    </svg>
  );
}
