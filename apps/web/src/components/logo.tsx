import { useId } from "react";

/** The brand mark of the Figma "Logo" component: a rounded square with a rising line. */
export function Logo({ className }: { className?: string }) {
  const gradientId = useId();

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="28"
      viewBox="0 0 28 28"
      width="28"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 6C0 2.68629 2.68629 0 6 0H22C25.3137 0 28 2.68629 28 6V22C28 25.3137 25.3137 28 22 28H6C2.68629 28 0 25.3137 0 22V6Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M17 10.25H21.5V14.75"
        stroke="#262524"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M21.5 10.25L15.125 16.625L11.375 12.875L6.5 17.75"
        stroke="#262524"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={gradientId}
          x1="3.28224"
          x2="24.3222"
          y1="4.75503"
          y2="23.2702"
        >
          <stop stopColor="#FDBD74" />
          <stop offset="1" stopColor="#F2600C" />
        </linearGradient>
      </defs>
    </svg>
  );
}
