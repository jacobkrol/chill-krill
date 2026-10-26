import './bubble-group.css';

interface BubbleGroupProps {
  filled?: boolean;
  size?: number;
  label?: string;
}

function BubbleGroup(props: BubbleGroupProps) {
  const { filled, size = 22, label = "" } = props;
  return (
    <div className={`bubble-group ${filled ? "filled" : ""}`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 64 64`} width={size} height={size} fill="none" aria-label="Four underwater bubbles">
        <circle className="bubble" cx="22" cy="39" r="15"/>
        <circle className="bubble" cx="44" cy="43" r="10"/>
        <circle className="bubble" cx="41" cy="18" r="12"/>
        <circle className="bubble" cx="17" cy="14" r="6"/>
        <path className="shine" d="M14 34a9 9 0 0 1 6-5"/>
        <path className="shine" d="M39 12a7 7 0 0 1 5-1"/>
        <path className="shine" d="M40 39a5 5 0 0 1 3-2"/>
        <path className="shine" d="M15 12l2-1"/>
      </svg>
      {label.length && <p className="bubble-group-label">{label}</p>}
    </div>
  )
}

export default BubbleGroup