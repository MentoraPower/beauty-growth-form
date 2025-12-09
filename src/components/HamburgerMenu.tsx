import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MenuItem {
  label: string;
  href: string;
}

const menuItems: MenuItem[] = [
  { label: "Início", href: "/" },
  { label: "Sobre", href: "#sobre" },
  { label: "Serviços", href: "#servicos" },
  { label: "Contato", href: "#contato" },
];

const HamburgerMenu = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 px-5 pt-4">
      {/* Header bar */}
      <div className="flex items-center justify-between py-3 px-4 bg-white/80 backdrop-blur-xl rounded-2xl">
        <span className="font-bold text-lg text-foreground">Scale Beauty</span>
        
        {/* Hamburger button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-10 h-10 flex items-center justify-center"
          aria-label="Menu"
        >
          <div className="flex flex-col justify-center items-end w-6 h-6">
            <motion.span
              animate={isOpen ? { rotate: 45, y: 5, width: 24 } : { rotate: 0, y: 0, width: 24 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="block h-0.5 bg-foreground rounded-full"
              style={{ width: 24 }}
            />
            <motion.span
              animate={isOpen ? { rotate: -45, y: -5, width: 24 } : { rotate: 0, y: 0, width: 16 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="block h-0.5 bg-foreground rounded-full mt-2"
              style={{ width: isOpen ? 24 : 16 }}
            />
          </div>
        </button>
      </div>

      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl mt-2"
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
                  className="block py-3 text-foreground font-medium text-base hover:text-primary transition-colors border-b border-black/5 last:border-b-0"
                >
                  {item.label}
                </motion.a>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HamburgerMenu;
