import React from 'react';

interface HomeRecipeLogoProps {
  className?: string;
  customLogoUrl?: string;
  variant?: 'light' | 'dark'; // light is for dark backgrounds, dark is for white backgrounds
  size?: 'sm' | 'md' | 'lg';
}

export const HomeRecipeLogo: React.FC<HomeRecipeLogoProps> = ({
  className = '',
  customLogoUrl,
  size = 'md',
}) => {
  if (customLogoUrl && customLogoUrl.trim()) {
    const sizeClasses = {
      sm: 'h-7 max-w-[115px]',
      md: 'h-10 max-w-[165px]',
      lg: 'h-16 max-w-[220px]',
    };
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <img
          src={customLogoUrl}
          alt="Company Logo"
          referrerPolicy="no-referrer"
          className={`${sizeClasses[size]} object-contain`}
        />
      </div>
    );
  }

  // Exact reproduction of Home Recipe Foods brand mascot + cursive logo
  const dimensions = {
    sm: { width: 115, height: 36, iconSize: 30, titleSize: 20, subSize: 10 },
    md: { width: 165, height: 52, iconSize: 44, titleSize: 26, subSize: 13 },
    lg: { width: 220, height: 72, iconSize: 60, titleSize: 36, subSize: 18 },
  }[size];

  return (
    <div
      className={`inline-flex items-center gap-2 select-none ${className}`}
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox="0 0 200 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-auto h-auto max-w-full"
      >
        {/* Chef Mascot Illustration */}
        <g transform="translate(4, 2)">
          {/* Chef Hat */}
          <path
            d="M20 22 C14 20, 10 14, 16 7 C21 1, 31 1, 35 6 C40 2, 49 3, 50 10 C54 13, 53 19, 47 22 Z"
            fill="#FFFFFF"
            stroke="#1F2937"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Hat Pleats */}
          <path d="M24 16 Q27 8 30 15" stroke="#E5E7EB" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M34 14 Q37 7 40 15" stroke="#E5E7EB" strokeWidth="1.5" strokeLinecap="round" />
          {/* Hat Band */}
          <path d="M19 22 L48 22" stroke="#E5E7EB" strokeWidth="3" strokeLinecap="round" />

          {/* Chef Face */}
          <circle cx="33" cy="30" r="12" fill="#FDE047" stroke="#1F2937" strokeWidth="2" />
          {/* Chef Moustache & Smile */}
          <path
            d="M28 32 Q33 36 38 32 Q35 30 33 32 Q31 30 28 32 Z"
            fill="#1F2937"
          />
          {/* Chef Wink Eye */}
          <path d="M26 27 Q29 25 31 27" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" fill="none" />
          <circle cx="37" cy="27" r="2" fill="#1F2937" />
          {/* Rosy Cheeks */}
          <ellipse cx="25" cy="32" rx="2" ry="1.2" fill="#FCA5A5" opacity="0.8" />
          <ellipse cx="41" cy="32" rx="2" ry="1.2" fill="#FCA5A5" opacity="0.8" />

          {/* Chef Body / Yellow Shirt */}
          <path
            d="M21 42 C20 48, 25 58, 33 58 C41 58, 46 48, 45 42 Z"
            fill="#FACC15"
            stroke="#1F2937"
            strokeWidth="2"
          />
          {/* Red Tie / Neckerchief */}
          <path d="M31 42 L35 42 L33 48 Z" fill="#DC2626" />
          {/* Apron Buttons */}
          <circle cx="33" cy="49" r="1.3" fill="#1F2937" />
          <circle cx="33" cy="53" r="1.3" fill="#1F2937" />

          {/* Chef Hand Gesturing OK / Delicious */}
          <path
            d="M45 44 C49 42, 53 45, 51 49 C49 52, 45 50, 44 47"
            fill="#FDE047"
            stroke="#1F2937"
            strokeWidth="1.8"
          />
        </g>

        {/* Brand Text: "Home" in vibrant cursive red script */}
        <text
          x="62"
          y="35"
          fill="#DC2626"
          fontFamily="system-ui, -apple-system, 'Brush Script MT', 'Segoe Script', cursive, sans-serif"
          fontWeight="900"
          fontSize="36"
          fontStyle="italic"
          letterSpacing="0.5px"
        >
          Home
        </text>

        {/* Brand Text: "Recipe Foods" in cursive golden yellow with delicate red underline accent */}
        <text
          x="65"
          y="54"
          fill="#FACC15"
          fontFamily="system-ui, -apple-system, 'Brush Script MT', 'Segoe Script', cursive, sans-serif"
          fontWeight="800"
          fontSize="17"
          fontStyle="italic"
          letterSpacing="0.5px"
          stroke="#991B1B"
          strokeWidth="0.5"
        >
          Recipe Foods
        </text>
      </svg>
    </div>
  );
};
