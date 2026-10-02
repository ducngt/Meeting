import React from 'react';

interface NuteLogoProps {
  className?: string;
  size?: number;
}

export const NuteLogo: React.FC<NuteLogoProps> = ({ className = 'w-12 h-12', size }) => {
  return (
    <svg
      viewBox="0 0 500 500"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Đường dẫn cung tròn cho chữ uốn lượn trên */}
        <path
          id="nute-text-path-top"
          d="M 60,250 A 190,190 0 1,1 440,250"
          fill="none"
        />
        {/* Đường dẫn cho chữ tiếng Anh */}
        <path
          id="nute-text-path-sub"
          d="M 65,285 A 185,185 0 0,0 435,285"
          fill="none"
        />
      </defs>

      {/* Vành tròn ngoài cùng màu xanh đậm */}
      <circle cx="250" cy="250" r="242" fill="#0A1E60" />
      {/* Vành màu vàng sáng thương hiệu NUTE */}
      <circle cx="250" cy="250" r="236" fill="#FEE000" stroke="#0A1E60" strokeWidth="4" />
      {/* Vòng chỉ viền trong */}
      <circle cx="250" cy="250" r="226" fill="none" stroke="#0A1E60" strokeWidth="2.5" />

      {/* DÒNG CHỮ CONG TRÊN: TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT NAM ĐỊNH */}
      <text fill="#CD1019" fontWeight="900" fontSize="23" letterSpacing="0.8px" textAnchor="middle">
        <textPath href="#nute-text-path-top" startOffset="50%">
          TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT NAM ĐỊNH
        </textPath>
      </text>

      {/* BIỂU TƯỢNG NGUYÊN TỬ (ATOM - KHOA HỌC & CÔNG NGHỆ) */}
      <g transform="translate(250, 160)">
        {/* Quỹ đạo elip 1 */}
        <ellipse cx="0" cy="0" rx="72" ry="26" fill="none" stroke="#0A1E60" strokeWidth="5.5" />
        {/* Quỹ đạo elip 2 nghiêng 60 độ */}
        <ellipse cx="0" cy="0" rx="72" ry="26" fill="none" stroke="#0A1E60" strokeWidth="5.5" transform="rotate(60)" />
        {/* Quỹ đạo elip 3 nghiêng -60 độ */}
        <ellipse cx="0" cy="0" rx="72" ry="26" fill="none" stroke="#0A1E60" strokeWidth="5.5" transform="rotate(-60)" />
        {/* Hạt nhân trung tâm màu xanh đậm */}
        <circle cx="0" cy="0" r="13" fill="#0A1E60" />
      </g>

      {/* BIỂU TƯỢNG CUỐN SÁCH MỞ (GIÁO DỤC SƯ PHẠM) */}
      <g transform="translate(250, 240)" fill="#0A1E60">
        {/* Cánh sách trên */}
        <polygon points="-195,-22 0,42 195,-22 195,15 0,72 -195,15" />
        {/* Cánh sách dưới */}
        <polygon points="-180,25 0,80 180,25 180,48 0,105 -180,48" />
      </g>

      {/* DÒNG CHỮ TIẾNG ANH: NAMDINH UNIVERSITY OF TECHNOLOGY EDUCATION */}
      <text
        x="250"
        y="320"
        fill="#CD1019"
        fontWeight="800"
        fontSize="14.5"
        letterSpacing="0.5px"
        textAnchor="middle"
        fontFamily="sans-serif"
      >
        NAMDINH UNIVERSITY OF TECHNOLOGY EDUCATION
      </text>

      {/* TÊN VIẾT TẮT NUTE NỔI BẬT */}
      <text
        x="250"
        y="368"
        fill="#CD1019"
        fontWeight="900"
        fontSize="44"
        letterSpacing="2px"
        textAnchor="middle"
        fontFamily="sans-serif"
      >
        NUTE
      </text>

      {/* BIỂU TƯỢNG BÁNH RĂNG KỸ THUẬT PHÍA DƯỚI */}
      <g transform="translate(250, 410)" fill="#0A1E60">
        <path
          d="M -190,-45 
             A 200,200 0 0,0 190,-45 
             L 165,-30 
             A 170,170 0 0,1 -165,-30 Z"
        />
        {/* Các răng cưa bánh răng */}
        {[-70, -50, -30, -10, 10, 30, 50, 70].map((deg, i) => (
          <rect
            key={i}
            x="-14"
            y="-6"
            width="28"
            height="18"
            transform={`rotate(${deg}, 0, -160) translate(0, 15)`}
          />
        ))}
      </g>
    </svg>
  );
};
