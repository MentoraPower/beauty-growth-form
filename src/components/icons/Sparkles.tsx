const Sparkles = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M19 13l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
    <path d="M6 17l.5 1.5L8 19l-1.5.5L6 21l-.5-1.5L4 19l1.5-.5L6 17z" />
  </svg>
);

export default Sparkles;
