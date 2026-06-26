import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToHashElement = () => {
  const { hash, pathname, key } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.replace("#", "");
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    } else if (pathname) {
      // Small timeout to allow the browser to manage its own scroll restoration first if it likes
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 0);
    }
  }, [hash, pathname, key]);

  return null;
};

export default ScrollToHashElement;
