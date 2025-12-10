import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MenuItem {
  label: string;
  href: string;
}

const menuItems: MenuItem[] = [
  { label: "Início", href: "/" },
  { label: "Sobre", href: "#quem-somos" },
  { label: "Serviços", href: "#servicos" },
];

type NavTheme = "light" | "dark";

const HamburgerMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<NavTheme>("light");
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      
      // Hide/show based on scroll direction
      if (scrollY > lastScrollY.current && scrollY > 100) {
        setIsVisible(false);
        setIsOpen(false);
      } else {
        setIsVisible(true);
      }
      lastScrollY.current = scrollY;
      
      // Theme based on scroll position
      if (scrollY < 180) {
        setTheme("light");
      } else if (scrollY < viewportHeight * 0.8) {
        setTheme("dark");
      } else {
        setTheme("light");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const bgClass = theme === "dark" 
    ? "bg-neutral-900/80 backdrop-blur-xl" 
    : "bg-white/80 backdrop-blur-xl";
  
  const textClass = theme === "dark" ? "text-white" : "text-foreground";
  const barClass = theme === "dark" ? "bg-white" : "bg-foreground";
  const borderClass = theme === "dark" ? "border-white/10" : "border-white/10";
  const underlineClass = theme === "dark" ? "bg-white" : "bg-foreground";

  return (
    <>
      {/* Mobile navbar - hides on scroll */}
      <motion.div 
        className="md:hidden fixed top-0 left-0 right-0 z-50 px-5 pt-4"
        initial={{ y: 0 }}
        animate={{ y: isVisible ? 0 : -100 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <div className="mx-auto w-full max-w-5xl">
          <motion.div 
            className={`flex items-center justify-between py-2 px-4 rounded-xl transition-colors duration-300 ${bgClass}`}
            layout
          >
            <span className={`font-bold text-sm uppercase tracking-tight transition-colors duration-300 ${textClass}`}>
              Scale Beauty
            </span>
            
            <div className="relative">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative w-10 h-10 flex items-center justify-center"
                aria-label="Menu"
              >
                <div className="flex flex-col justify-center items-end w-6 h-6">
                  <motion.span
                    animate={isOpen ? { rotate: 45, y: 5, width: 24 } : { rotate: 0, y: 0, width: 24 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className={`block h-0.5 rounded-full transition-colors duration-300 ${barClass}`}
                    style={{ width: 24 }}
                  />
                  <motion.span
                    animate={isOpen ? { rotate: -45, y: -5, width: 24 } : { rotate: 0, y: 0, width: 16 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className={`block h-0.5 rounded-full mt-2 transition-colors duration-300 ${barClass}`}
                    style={{ width: isOpen ? 24 : 16 }}
                  />
                </div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className={`absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-2xl transition-colors duration-300 ${bgClass}`}
                  >
                    <nav className="px-4 py-3">
                      {menuItems.map((item, index) => (
                        <motion.a
                          key={item.label}
                          href={item.href}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ 
                            duration: 0.2, 
                            delay: index * 0.05,
                            ease: "easeOut"
                          }}
                          onClick={() => setIsOpen(false)}
                          className={`block py-3 font-medium text-base hover:text-primary transition-colors ${textClass} border-b ${borderClass} last:border-b-0`}
                        >
                          {item.label}
                        </motion.a>
                      ))}
                    </nav>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Desktop navbar - static, scrolls with page, white text */}
      <div className="hidden md:block absolute top-0 left-0 right-0 z-50 px-5 pt-4">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex items-center justify-between py-3">
            <span className="font-bold text-sm uppercase tracking-tight text-white">
              Scale Beauty
            </span>
            
            <nav className="flex items-center gap-8">
              {menuItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="relative text-sm font-medium text-white group"
                >
                  {item.label}
                  <span 
                    className="absolute left-0 -bottom-1 h-[1px] w-0 bg-white transition-all duration-300 ease-out group-hover:w-full"
                  />
                </a>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </>
  );
};

export default HamburgerMenu;
