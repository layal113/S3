import Svg, { Circle, Line, Path } from 'react-native-svg';

export function MiqyasGaugeLogo({
  color,
  size = 54,
  trackColor,
}: {
  color: string;
  size?: number;
  trackColor: string;
}) {
  return (
    <Svg
      accessibilityLabel="Miqyas gauge logo"
      fill="none"
      height={size * 0.7}
      role="img"
      viewBox="0 0 72 50"
      width={size}
    >
      <Path
        d="M8 39 A28 28 0 0 1 64 39"
        stroke={trackColor}
        strokeLinecap="round"
        strokeWidth="7"
      />
      <Path
        d="M8 39 A28 28 0 0 1 64 39"
        stroke={color}
        strokeDasharray="70 90"
        strokeLinecap="round"
        strokeWidth="7"
      />
      <Line
        stroke={color}
        strokeLinecap="round"
        strokeWidth="4"
        x1="36"
        x2="54"
        y1="39"
        y2="30"
      />
      <Circle cx="36" cy="39" fill={color} r="5" />
    </Svg>
  );
}
