/* @ds-bundle: {"format":3,"namespace":"StorefrontQuinceDesignSystem_5573fd","components":[],"sourceHashes":{"ui_kits/storefront/App.jsx":"8fdd37f93e99","ui_kits/storefront/CategoryRail.jsx":"e00cbd67fb85","ui_kits/storefront/Footer.jsx":"d39e4146ed5b","ui_kits/storefront/Header.jsx":"93b227787df6","ui_kits/storefront/Primitives.jsx":"d723d392ee44","ui_kits/storefront/ProductGrid.jsx":"866d66309f4b","ui_kits/storefront/QuickView.jsx":"f504ca50d9bf"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.StorefrontQuinceDesignSystem_5573fd = window.StorefrontQuinceDesignSystem_5573fd || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/storefront/App.jsx
try { (() => {
// Top-level app — Quince storefront PLP (Home / Luxe Sheets & Bedding).

const SW = {
  cream: '#EFE6D8',
  oat: '#D9CEB8',
  grey: '#9C9C9C',
  olive: '#6E6B3E',
  forest: '#2D4A36',
  sand: '#F0EDE2',
  rust: '#8A6148',
  stone: '#DFDACE',
  tan: '#B0ACA1',
  paperwhite: '#F7F7F5'
};
const PRODUCTS = [{
  id: 1,
  title: 'Premium Down Alternative Comforter',
  price: 99.90,
  rating: 4.8,
  badges: ['Best seller'],
  image: window.__resources.p2,
  colors: [SW.paperwhite]
}, {
  id: 2,
  title: 'Premium Down Comforter',
  price: 159.90,
  rating: 4.8,
  badges: ['Bundle and save', 'Best seller'],
  image: window.__resources.p2,
  colors: [SW.paperwhite]
}, {
  id: 3,
  title: 'Bamboo Sheet Set',
  price: 100.00,
  rating: 4.8,
  badges: ['Bundle and save', 'Best seller'],
  image: window.__resources.p1,
  colors: [SW.oat, SW.grey, SW.olive, SW.forest, SW.sand],
  selectedColor: 0,
  deliveryBy: 'Fri, Apr 24'
}, {
  id: 4,
  title: 'Classic Organic Percale Sheet Set',
  price: 79.90,
  rating: 4.5,
  badges: ['Bundle and save'],
  image: window.__resources.p1,
  colors: [SW.paperwhite, SW.rust, SW.cream, SW.tan]
}];
const CATEGORIES = [{
  label: 'Bedding',
  image: window.__resources.p1
}, {
  label: 'Sheets & Sets',
  image: window.__resources.p2
}, {
  label: 'Duvet Covers & Sh…',
  image: window.__resources.p1
}, {
  label: 'Quilts & Bedsprea…',
  image: window.__resources.p2
}, {
  label: 'Inserts & Essentials',
  image: window.__resources.p1
}, {
  label: 'Pillowcases & Sha…',
  image: window.__resources.p2
}, {
  label: 'Bedding Bundles',
  image: window.__resources.p1
}, {
  label: 'Throws & Blankets',
  image: window.__resources.p2
}, {
  label: 'Decorative Pillow c…',
  image: window.__resources.p1
}];
const App = () => {
  const [quick, setQuick] = React.useState(null);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [cart, setCart] = React.useState([]);
  const [activeCat, setActiveCat] = React.useState('Bedding');
  const addToCart = p => {
    setCart(c => [...c, {
      ...p,
      qty: 1
    }]);
    setQuick(null);
    setCartOpen(true);
  };
  const removeFromCart = idx => setCart(c => c.filter((_, i) => i !== idx));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement(Header, {
    onCartOpen: () => setCartOpen(true),
    cartCount: cart.length
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      maxWidth: 1440,
      margin: '0 auto',
      padding: '22px 40px 64px'
    }
  }, /*#__PURE__*/React.createElement(Breadcrumbs, {
    trail: ['Home', 'Duvet Covers & Shams', 'Lifestyle']
  }), /*#__PURE__*/React.createElement(CategoryTitle, null, "Duvet Covers & Shams"), /*#__PURE__*/React.createElement(CategoryRail, {
    items: CATEGORIES,
    active: activeCat,
    onSelect: setActiveCat
  }), /*#__PURE__*/React.createElement(FilterBar, {
    count: 390,
    sort: "",
    pills: ['Filter', 'Color', 'Size', 'Material', 'Price Range', 'Department', 'Category', 'Type']
  }), /*#__PURE__*/React.createElement(ProductGrid, {
    products: PRODUCTS,
    onProductClick: p => setQuick(p)
  })), /*#__PURE__*/React.createElement(TrustStrip, null), /*#__PURE__*/React.createElement(Footer, null), /*#__PURE__*/React.createElement(QuickView, {
    product: quick,
    onClose: () => setQuick(null),
    onAdd: addToCart
  }), /*#__PURE__*/React.createElement(CartDrawer, {
    open: cartOpen,
    items: cart,
    onClose: () => setCartOpen(false),
    onRemove: removeFromCart
  }));
};
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/storefront/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/storefront/CategoryRail.jsx
try { (() => {
// Breadcrumb + category title + circular category chip rail + filter bar.

const Breadcrumbs = ({
  trail
}) => /*#__PURE__*/React.createElement("nav", {
  style: {
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    color: 'var(--color-mediumgray)',
    letterSpacing: '0.01em',
    marginBottom: 10
  }
}, trail.map((t, i) => /*#__PURE__*/React.createElement(React.Fragment, {
  key: i
}, /*#__PURE__*/React.createElement("a", {
  href: "#",
  style: {
    color: 'var(--color-mediumgray)',
    textDecoration: 'none'
  }
}, t), i < trail.length - 1 && /*#__PURE__*/React.createElement("span", {
  style: {
    padding: '0 8px',
    color: 'var(--color-silvergray)'
  }
}, "/"))));
const CategoryTitle = ({
  children
}) => /*#__PURE__*/React.createElement("h1", {
  style: {
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    fontSize: 20,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--color-darkgray)',
    margin: '0 0 24px'
  }
}, children);
const CategoryRail = ({
  items,
  active,
  onSelect
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    gap: 28,
    marginBottom: 28,
    overflowX: 'auto',
    paddingBottom: 4
  }
}, items.map(it => {
  const isActive = it.label === active;
  return /*#__PURE__*/React.createElement("button", {
    key: it.label,
    onClick: () => onSelect?.(it.label),
    style: {
      background: 'transparent',
      border: 0,
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      minWidth: 88
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 82,
      height: 82,
      borderRadius: 9999,
      overflow: 'hidden',
      background: 'var(--color-paperwhite)',
      border: isActive ? '1.5px solid var(--color-darkgray)' : '1.5px solid transparent',
      display: 'block',
      boxSizing: 'border-box'
    }
  }, it.image && /*#__PURE__*/React.createElement("img", {
    src: it.image,
    alt: it.label,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 12,
      color: 'var(--color-darkgray)',
      fontWeight: isActive ? 500 : 400
    }
  }, it.label));
}));
const FilterBar = ({
  count,
  sort = 'Featured',
  pills
}) => {
  const defaultPills = ['Filter', 'Product Type', 'Color', 'Size', 'Material', 'Price Range', 'Style', 'Sleeve Length'];
  const shown = pills || defaultPills;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 0',
      gap: 8,
      flexWrap: 'wrap',
      borderBottom: '1px solid var(--color-lightgray)',
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, shown.map((p, i) => /*#__PURE__*/React.createElement("button", {
    key: p,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 32,
      padding: '0 14px',
      border: '1px solid var(--color-lightgray)',
      background: '#fff',
      borderRadius: 9999,
      fontFamily: 'var(--font-sans)',
      fontSize: 12,
      color: 'var(--color-darkgray)',
      cursor: 'pointer'
    }
  }, p === 'Filter' && /*#__PURE__*/React.createElement(Icon, {
    name: "menu",
    size: 12
  }), /*#__PURE__*/React.createElement("span", null, p), p !== 'Filter' && /*#__PURE__*/React.createElement(Icon, {
    name: "chevron",
    size: 12
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 12,
      color: 'var(--color-mediumgray)'
    }
  }, count, " items"), /*#__PURE__*/React.createElement("button", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 32,
      padding: '0 14px',
      border: '1px solid var(--color-lightgray)',
      background: '#fff',
      borderRadius: 9999,
      fontFamily: 'var(--font-sans)',
      fontSize: 12,
      color: 'var(--color-darkgray)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Sort By", sort ? `: ${sort}` : ''), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron",
    size: 12
  }))));
};
Object.assign(window, {
  Breadcrumbs,
  CategoryTitle,
  CategoryRail,
  FilterBar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/storefront/CategoryRail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/storefront/Footer.jsx
try { (() => {
// Footer + small marketing strips.

const TrustStrip = () => /*#__PURE__*/React.createElement("section", {
  style: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    padding: '32px 48px',
    borderTop: '1px solid var(--color-lightgray)',
    borderBottom: '1px solid var(--color-lightgray)',
    background: '#fff'
  }
}, [{
  icon: 'truck',
  title: 'Free shipping over $75',
  meta: 'On all U.S. orders'
}, {
  icon: 'check',
  title: 'Factory-direct pricing',
  meta: '50–80% less than luxury brands'
}, {
  icon: 'heart',
  title: '365-day returns',
  meta: 'Easy, free, no questions'
}].map(c => /*#__PURE__*/React.createElement("div", {
  key: c.title,
  style: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    justifyContent: 'center'
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    color: 'var(--color-darkgray)'
  }
}, /*#__PURE__*/React.createElement(Icon, {
  name: c.icon,
  size: 22
})), /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: 'var(--font-sans)'
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.05em',
    textTransform: 'uppercase'
  }
}, c.title), /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 11,
    color: 'var(--color-mediumgray)',
    marginTop: 2
  }
}, c.meta)))));
const NAVY = '#232B3B';
const NAVY_RULE = 'rgba(255,255,255,0.12)';
const MUTED = 'rgba(255,255,255,0.72)';
const FooterCol = ({
  title,
  links
}) => /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#fff',
    marginBottom: 18
  }
}, title), /*#__PURE__*/React.createElement("ul", {
  style: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  }
}, links.map(l => /*#__PURE__*/React.createElement("li", {
  key: l
}, /*#__PURE__*/React.createElement("a", {
  href: "#",
  style: {
    fontSize: 12,
    color: MUTED,
    textDecoration: 'none'
  }
}, l)))));
const SocialIcon = ({
  name
}) => {
  const paths = {
    facebook: /*#__PURE__*/React.createElement("path", {
      d: "M13.5 22v-8h2.7l.4-3.2h-3.1V8.7c0-.9.3-1.5 1.6-1.5h1.7V4.3c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.5H7.7V14h2.6v8h3.2z"
    }),
    instagram: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "3.5",
      y: "3.5",
      width: "17",
      height: "17",
      rx: "4.5",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.4"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "4",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.4"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "17",
      cy: "7",
      r: "1",
      fill: "currentColor"
    })),
    tiktok: /*#__PURE__*/React.createElement("path", {
      d: "M15 3v10.2a3 3 0 11-3-3V7.7a6 6 0 106 6V8.2a6 6 0 003.3 1V6a3.3 3.3 0 01-3.3-3H15z"
    })
  };
  return /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-label": name
  }, paths[name]);
};
const Footer = () => /*#__PURE__*/React.createElement("footer", {
  style: {
    background: NAVY,
    color: '#fff',
    fontFamily: 'var(--font-sans)'
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '56px 40px 0'
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'grid',
    gridTemplateColumns: '1.25fr 0.9fr 1.05fr 1.1fr 1.2fr',
    gap: 40
  }
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
  style: {
    margin: 0,
    fontSize: 12,
    color: MUTED,
    lineHeight: '18px'
  }
}, "Offers, new arrivals, restocks and more."), /*#__PURE__*/React.createElement("label", {
  style: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 14,
    height: 44,
    border: `1px solid ${NAVY_RULE}`,
    padding: '0 0 0 16px'
  }
}, /*#__PURE__*/React.createElement("input", {
  placeholder: "EMAIL ADDRESS",
  style: {
    flex: 1,
    border: 0,
    background: 'transparent',
    outline: 'none',
    color: '#fff',
    fontFamily: 'var(--font-sans)',
    fontSize: 11,
    letterSpacing: '0.08em'
  }
}), /*#__PURE__*/React.createElement("button", {
  "aria-label": "Subscribe",
  style: {
    background: 'transparent',
    border: 0,
    cursor: 'pointer',
    width: 44,
    height: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff'
  }
}, /*#__PURE__*/React.createElement("svg", {
  width: "16",
  height: "16",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M4 12h16M14 6l6 6-6 6"
}))))), /*#__PURE__*/React.createElement(FooterCol, {
  title: "Products",
  links: ['Men', 'Women', 'Home', 'Jewelry', 'Gift Cards', 'Partner Offers']
}), /*#__PURE__*/React.createElement(FooterCol, {
  title: "Quince",
  links: ['About Us', 'Refer & Earn', 'How it Works', 'Our Values', 'Our Factories', 'Sustainability', 'Press', 'Cashmere 101', 'Cookware 101', 'Leather 101', 'Silk 101', 'Bedding 101', 'Luggage 101', 'Careers', 'Service Discount', 'Educational Discount', 'Partner Offers', 'Quince Offers']
}), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FooterCol, {
  title: "Customer Service",
  links: ['My Account', 'FAQ', 'My Orders', 'Start a Return', 'Shipping & Returns', 'Warranty Policy', 'Security', 'Contact Us']
}), /*#__PURE__*/React.createElement("div", {
  style: {
    height: 28
  }
}), /*#__PURE__*/React.createElement(FooterCol, {
  title: "Quince Business",
  links: ['Business Solutions', 'Corporate Gifting', 'Interior Design', 'White Label', 'Hospitality', 'Branded Storefront', 'Uniforms']
})), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#fff',
    marginBottom: 18
  }
}, "Country/Region"), /*#__PURE__*/React.createElement("button", {
  style: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    background: 'transparent',
    border: 0,
    cursor: 'pointer',
    color: '#fff',
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    padding: 0
  }
}, /*#__PURE__*/React.createElement("span", {
  "aria-hidden": "true",
  style: {
    fontSize: 14
  }
}, "\uD83C\uDDFA\uD83C\uDDF8"), /*#__PURE__*/React.createElement("span", null, "United States ($USD)"), /*#__PURE__*/React.createElement("svg", {
  width: "12",
  height: "12",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.4",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M5 8l7 7 7-7"
}))), /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#fff',
    margin: '32px 0 16px'
  }
}, "Follow Us"), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    gap: 18,
    color: '#fff'
  }
}, /*#__PURE__*/React.createElement("a", {
  href: "#",
  style: {
    color: '#fff'
  }
}, /*#__PURE__*/React.createElement(SocialIcon, {
  name: "facebook"
})), /*#__PURE__*/React.createElement("a", {
  href: "#",
  style: {
    color: '#fff'
  }
}, /*#__PURE__*/React.createElement(SocialIcon, {
  name: "instagram"
})), /*#__PURE__*/React.createElement("a", {
  href: "#",
  style: {
    color: '#fff'
  }
}, /*#__PURE__*/React.createElement(SocialIcon, {
  name: "tiktok"
}))))), /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 80
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    fontFamily: "'IvyPresto Headline', Georgia, serif",
    fontWeight: 300,
    fontSize: 84,
    letterSpacing: '0.005em',
    color: '#fff',
    lineHeight: 1
  }
}, "Quince"))), /*#__PURE__*/React.createElement("div", {
  style: {
    borderTop: `1px solid ${NAVY_RULE}`,
    marginTop: 28
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '18px 40px',
    display: 'flex',
    alignItems: 'center',
    gap: 28,
    flexWrap: 'wrap',
    fontSize: 11,
    color: MUTED,
    letterSpacing: '0.01em'
  }
}, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 Quince. All Rights Reserved."), /*#__PURE__*/React.createElement("a", {
  href: "#",
  style: {
    color: MUTED,
    textDecoration: 'none'
  }
}, "Terms of Service"), /*#__PURE__*/React.createElement("a", {
  href: "#",
  style: {
    color: MUTED,
    textDecoration: 'none'
  }
}, "Privacy Policy"), /*#__PURE__*/React.createElement("a", {
  href: "#",
  style: {
    color: MUTED,
    textDecoration: 'none'
  }
}, "Accessibility"), /*#__PURE__*/React.createElement("a", {
  href: "#",
  style: {
    color: MUTED,
    textDecoration: 'none'
  }
}, "Referral Policy"), /*#__PURE__*/React.createElement("a", {
  href: "#",
  style: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: MUTED,
    textDecoration: 'none'
  }
}, "Your Privacy Choices", /*#__PURE__*/React.createElement("span", {
  style: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    background: '#1E4FC6',
    color: '#fff',
    height: 14,
    padding: '0 5px',
    fontSize: 9,
    fontWeight: 600,
    borderRadius: 2
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    transform: 'translateY(-0.5px)'
  }
}, "\u2713"), /*#__PURE__*/React.createElement("span", {
  style: {
    opacity: 0.7
  }
}, "\xD7"))), /*#__PURE__*/React.createElement("a", {
  href: "#",
  style: {
    color: MUTED,
    textDecoration: 'none'
  }
}, "Cookie Management"))));
Object.assign(window, {
  TrustStrip,
  Footer
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/storefront/Footer.jsx", error: String((e && e.message) || e) }); }

// ui_kits/storefront/Header.jsx
try { (() => {
// Quince storefront header — matches reference exactly.
// Row 1: cantaloupe announcement bar.
// Row 2: [wordmark (left)] ... [search (right)] [Sign In] [heart] [bag] [US].
// Row 3: left-aligned nav (Everyday Steals ... The Archive).

const NAV = ['Everyday Steals', '$50 Cashmere', 'New Arrivals', 'Best Sellers', 'Women', 'Men', 'Home', 'Baby & Kids', 'Travel', 'Bags & Accessories', 'Jewelry', 'Beauty & Wellness', 'Gifts', 'The Archive'];
const Header = ({
  onCartOpen,
  cartCount = 0
}) => /*#__PURE__*/React.createElement("header", {
  style: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    background: '#fff',
    borderBottom: '1px solid var(--color-lightgray)'
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    background: 'var(--color-cantaloupe-100)',
    color: 'var(--color-darkgray)',
    height: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    letterSpacing: '0.01em'
  }
}, "Free shipping & easy returns for 365 days."), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    alignItems: 'center',
    padding: '18px 40px',
    gap: 24,
    maxWidth: 1440,
    margin: '0 auto'
  }
}, /*#__PURE__*/React.createElement("a", {
  href: "#",
  style: {
    fontFamily: "'IvyPresto Headline', Georgia, serif",
    fontWeight: 300,
    fontSize: 32,
    letterSpacing: '0.01em',
    color: 'var(--color-darkgray)',
    textDecoration: 'none',
    lineHeight: 1
  }
}, "Quince"), /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--color-offwhite)',
    borderRadius: 4,
    width: 280,
    overflow: 'hidden'
  }
}, /*#__PURE__*/React.createElement("input", {
  placeholder: "Search",
  style: {
    flex: 1,
    border: 0,
    background: 'transparent',
    padding: '0 14px',
    height: 36,
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    color: 'var(--color-darkgray)',
    outline: 'none'
  }
}), /*#__PURE__*/React.createElement("button", {
  style: {
    background: 'var(--color-cantaloupe-100)',
    border: 0,
    height: 36,
    width: 40,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--color-darkgray)'
  }
}, /*#__PURE__*/React.createElement(Icon, {
  name: "search",
  size: 16
}))), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    alignItems: 'center',
    gap: 22,
    fontFamily: 'var(--font-sans)',
    fontSize: 13
  }
}, /*#__PURE__*/React.createElement("a", {
  href: "#",
  style: utilLink
}, /*#__PURE__*/React.createElement(Icon, {
  name: "user",
  size: 18
}), /*#__PURE__*/React.createElement("span", null, "Sign In")), /*#__PURE__*/React.createElement("button", {
  style: utilBtn
}, /*#__PURE__*/React.createElement(Icon, {
  name: "heart",
  size: 18
})), /*#__PURE__*/React.createElement("button", {
  style: utilBtn,
  onClick: onCartOpen,
  "aria-label": "Bag"
}, /*#__PURE__*/React.createElement("span", {
  style: {
    position: 'relative',
    display: 'inline-flex'
  }
}, /*#__PURE__*/React.createElement("svg", {
  width: "20",
  height: "20",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M5.5 7.5h13a.5.5 0 01.5.5l-.6 11.5a.5.5 0 01-.5.5H6.1a.5.5 0 01-.5-.5L5 8a.5.5 0 01.5-.5z"
}), /*#__PURE__*/React.createElement("path", {
  d: "M10 10.5a2 2 0 004 0"
})), cartCount > 0 && /*#__PURE__*/React.createElement("span", {
  style: {
    position: 'absolute',
    top: -4,
    right: -7,
    minWidth: 16,
    height: 16,
    padding: '0 4px',
    borderRadius: 9999,
    background: 'var(--color-cantaloupe-100)',
    color: 'var(--color-darkgray)',
    fontSize: 9,
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
}, cartCount))), /*#__PURE__*/React.createElement("button", {
  style: {
    ...utilBtn,
    gap: 5
  },
  "aria-label": "Region US"
}, /*#__PURE__*/React.createElement("svg", {
  width: "18",
  height: "18",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "9"
}), /*#__PURE__*/React.createElement("path", {
  d: "M3 12h18"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12 3c2.8 2.6 2.8 15.4 0 18"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12 3c-2.8 2.6-2.8 15.4 0 18"
})), /*#__PURE__*/React.createElement("span", {
  style: {
    fontSize: 11,
    letterSpacing: '0.02em'
  }
}, "us")))), /*#__PURE__*/React.createElement("nav", {
  style: {
    display: 'flex',
    justifyContent: 'flex-start',
    gap: 30,
    padding: '0 40px 14px',
    maxWidth: 1440,
    margin: '0 auto',
    flexWrap: 'nowrap',
    overflowX: 'auto',
    borderBottom: '1px solid var(--color-lightgray)'
  }
}, NAV.map(item => /*#__PURE__*/React.createElement("a", {
  key: item,
  href: "#",
  style: {
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: '0.01em',
    color: 'var(--color-darkgray)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    paddingBottom: 2
  }
}, item))));
const utilLink = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: 'var(--color-darkgray)',
  textDecoration: 'none',
  fontSize: 13,
  letterSpacing: '0.01em'
};
const utilBtn = {
  background: 'transparent',
  border: 0,
  cursor: 'pointer',
  padding: 4,
  color: 'var(--color-darkgray)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontFamily: 'var(--font-sans)',
  fontSize: 13
};
window.Header = Header;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/storefront/Header.jsx", error: String((e && e.message) || e) }); }

// ui_kits/storefront/Primitives.jsx
try { (() => {
// Shared small primitives for the Quince storefront UI kit.
// Components are exposed on window so sibling Babel scripts can import them.

const Icon = ({
  name,
  size = 20,
  strokeWidth = 1.2,
  style
}) => {
  const paths = {
    bag: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
      d: "M6 7h12l-1 13H7L6 7z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M9 7a3 3 0 016 0"
    })),
    search: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
      cx: "11",
      cy: "11",
      r: "6"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M20 20l-4.3-4.3"
    })),
    user: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "8",
      r: "4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M4 21c1-5 5-7 8-7s7 2 8 7"
    })),
    heart: /*#__PURE__*/React.createElement("path", {
      d: "M12 5.5c-3-3-8 0-5.5 4.5L12 16l5.5-6c2.5-4.5-2.5-7.5-5.5-4.5z"
    }),
    close: /*#__PURE__*/React.createElement("path", {
      d: "M18 6L6 18M6 6l12 12"
    }),
    chevron: /*#__PURE__*/React.createElement("path", {
      d: "M5 9l7 7 7-7"
    }),
    chevronR: /*#__PURE__*/React.createElement("path", {
      d: "M9 5l7 7-7 7"
    }),
    menu: /*#__PURE__*/React.createElement("path", {
      d: "M3 6h18M3 12h18M3 18h18"
    }),
    plus: /*#__PURE__*/React.createElement("path", {
      d: "M4 12h16M12 4v16"
    }),
    minus: /*#__PURE__*/React.createElement("path", {
      d: "M4 12h16"
    }),
    check: /*#__PURE__*/React.createElement("path", {
      d: "M5 12l5 5 9-10"
    }),
    truck: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
      d: "M4 6h12l4 4v8H4z"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "9",
      cy: "18",
      r: "2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "17",
      cy: "18",
      r: "2"
    })),
    star: /*#__PURE__*/React.createElement("path", {
      d: "M12 3l2.5 5.5L20 9l-4 4 1 5.5L12 16l-5 2.5L8 13 4 9l5.5-.5L12 3z"
    })
  };
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: strokeWidth,
    strokeLinecap: "square",
    strokeLinejoin: "round",
    style: {
      display: 'inline-block',
      verticalAlign: 'middle',
      ...style
    },
    "aria-hidden": "true"
  }, paths[name]);
};
const Button = ({
  variant = 'primary',
  size = 'md',
  children,
  leading,
  trailing,
  onClick,
  disabled,
  full,
  style
}) => {
  const heights = {
    sm: 32,
    md: 40,
    lg: 48
  };
  const fontSizes = {
    sm: 10,
    md: 12,
    lg: 13
  };
  const padX = {
    sm: 18,
    md: 24,
    lg: 32
  };
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    fontSize: fontSizes[size],
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    height: heights[size],
    padding: `0 ${padX[size]}px`,
    borderRadius: 9999,
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background-color 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out',
    width: full ? '100%' : 'auto'
  };
  const variants = {
    primary: {
      background: 'var(--color-cantaloupe-100)',
      color: 'var(--color-darkgray)'
    },
    secondary: {
      background: '#fff',
      color: 'var(--color-darkgray)',
      borderColor: 'var(--color-darkgray)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--color-darkgray)'
    },
    dark: {
      background: 'var(--color-darkgray)',
      color: '#fff'
    }
  };
  const disabledStyle = disabled ? {
    background: 'var(--color-offwhite)',
    color: 'var(--color-silvergray)',
    borderColor: 'transparent'
  } : null;
  return /*#__PURE__*/React.createElement("button", {
    onClick: disabled ? undefined : onClick,
    style: {
      ...base,
      ...variants[variant],
      ...disabledStyle,
      ...style
    }
  }, leading && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex'
    }
  }, leading), /*#__PURE__*/React.createElement("span", null, children), trailing && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex'
    }
  }, trailing));
};
const Tag = ({
  children,
  variant = 'outline',
  style
}) => {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    fontSize: 10,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '5px 10px',
    borderRadius: 9999,
    border: '1px solid transparent'
  };
  const variants = {
    outline: {
      background: '#fff',
      color: 'var(--color-darkgray)',
      borderColor: 'var(--color-lightgray)'
    },
    solid: {
      background: 'var(--color-cantaloupe-100)',
      color: 'var(--color-darkgray)'
    },
    dark: {
      background: 'var(--color-darkgray)',
      color: '#fff'
    },
    trans: {
      background: 'rgba(255,255,255,0.7)',
      color: 'var(--color-darkgray)',
      backdropFilter: 'blur(2px)'
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      ...base,
      ...variants[variant],
      ...style
    }
  }, children);
};
const Input = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  style
}) => /*#__PURE__*/React.createElement("input", {
  type: type,
  value: value,
  onChange: onChange,
  placeholder: placeholder,
  style: {
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    height: 44,
    padding: '0 14px',
    border: `1px solid ${error ? 'var(--color-red-100)' : 'var(--color-lightgray)'}`,
    background: '#fff',
    borderRadius: 2,
    color: 'var(--color-darkgray)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    ...style
  },
  onFocus: e => {
    if (!error) e.target.style.borderColor = 'var(--color-darkgray)';
  },
  onBlur: e => {
    if (!error) e.target.style.borderColor = 'var(--color-lightgray)';
  }
});
const Rich = ({
  size = '2xl',
  children,
  style
}) => {
  const sizes = {
    '2xl': {
      fontSize: '3rem',
      lineHeight: '3.25rem'
    },
    'xl': {
      fontSize: '2.25rem',
      lineHeight: '2.5rem'
    },
    'lg': {
      fontSize: '1.75rem',
      lineHeight: '2rem'
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'IvyPresto Headline', Georgia, serif",
      fontWeight: 300,
      color: 'var(--color-darkgray)',
      ...sizes[size],
      ...style
    }
  }, children);
};
const Caps = ({
  children,
  size = 'base',
  style
}) => {
  const sizes = {
    xs: {
      fontSize: 10,
      lineHeight: '12px'
    },
    sm: {
      fontSize: 11,
      lineHeight: '14px'
    },
    base: {
      fontSize: 12,
      lineHeight: '16px'
    },
    lg: {
      fontSize: 14,
      lineHeight: '18px'
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontWeight: 500,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: 'var(--color-darkgray)',
      ...sizes[size],
      ...style
    }
  }, children);
};
Object.assign(window, {
  Icon,
  Button,
  Tag,
  Input,
  Rich,
  Caps
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/storefront/Primitives.jsx", error: String((e && e.message) || e) }); }

// ui_kits/storefront/ProductGrid.jsx
try { (() => {
// ProductTile + ProductGrid — matches quince.com reference.
// Tile: image (hover: heart top-right, chip bottom-left), title + price on one row,
// star rating, color swatches + overflow, green free-delivery line.

const Star = ({
  size = 11
}) => /*#__PURE__*/React.createElement("svg", {
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M12 3l2.6 5.8 6.4.6-4.8 4.3 1.4 6.3L12 16.8 6.4 20l1.4-6.3-4.8-4.3 6.4-.6L12 3z"
}));
const ProductTile = ({
  product,
  onClick
}) => {
  const [hover, setHover] = React.useState(false);
  const extraColors = Math.max(0, (product.colors?.length || 0) - 5);
  const visibleSwatches = (product.colors || []).slice(0, 5);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      position: 'relative',
      border: 0,
      padding: 0,
      cursor: 'pointer',
      background: 'var(--color-paperwhite)',
      aspectRatio: '4 / 5',
      overflow: 'hidden',
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: product.image,
    alt: product.title,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 22,
      height: 22,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--color-darkgray)',
      background: 'transparent'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "heart",
    size: 18,
    strokeWidth: 1.1
  })), (product.badges || (product.badge ? [product.badge] : [])).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 10,
      bottom: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, (product.badges || [product.badge]).map(b => /*#__PURE__*/React.createElement("span", {
    key: b,
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 10,
      padding: '4px 8px',
      borderRadius: 2,
      background: 'rgba(255,255,255,0.88)',
      color: 'var(--color-darkgray)',
      letterSpacing: '0.01em',
      alignSelf: 'flex-start'
    }
  }, b)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 12,
      alignItems: 'baseline',
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      lineHeight: '18px',
      color: 'var(--color-darkgray)'
    }
  }, product.title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--color-darkgray)',
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap'
    }
  }, "From $", product.price.toFixed(2))), product.rating && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      color: 'var(--color-darkgray)'
    }
  }, /*#__PURE__*/React.createElement(Star, null), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontVariantNumeric: 'tabular-nums'
    }
  }, product.rating.toFixed(1))), visibleSwatches.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 2
    }
  }, visibleSwatches.map((c, i) => {
    const selected = i === (product.selectedColor ?? -1);
    if (selected) {
      return /*#__PURE__*/React.createElement("span", {
        key: i,
        style: {
          width: 28,
          height: 28,
          borderRadius: 9999,
          border: '1.25px solid var(--color-darkgray)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: 18,
          height: 18,
          borderRadius: 9999,
          background: c,
          boxShadow: 'inset 0 0 0 1px rgba(33,32,31,0.08)'
        }
      }));
    }
    return /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        width: 18,
        height: 18,
        borderRadius: 9999,
        background: c,
        display: 'inline-block',
        boxShadow: 'inset 0 0 0 1px rgba(33,32,31,0.08)'
      }
    });
  }), extraColors > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--color-mediumgray)',
      marginLeft: 2
    }
  }, "+", extraColors)), product.deliveryBy && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--color-green-100)',
      letterSpacing: '0.01em',
      marginTop: 2
    }
  }, "FREE delivery by ", product.deliveryBy));
};
const ProductGrid = ({
  products,
  onProductClick
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '40px 20px'
  }
}, products.map(p => /*#__PURE__*/React.createElement(ProductTile, {
  key: p.id,
  product: p,
  onClick: () => onProductClick(p)
})));
Object.assign(window, {
  ProductTile,
  ProductGrid
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/storefront/ProductGrid.jsx", error: String((e && e.message) || e) }); }

// ui_kits/storefront/QuickView.jsx
try { (() => {
// Product quick-view modal + cart drawer.

const QuickView = ({
  product,
  onClose,
  onAdd
}) => {
  const [size, setSize] = React.useState('M');
  const [color, setColor] = React.useState(0);
  if (!product) return null;
  const colors = [{
    name: 'Oat',
    hex: '#DFDACE'
  }, {
    name: 'Petal',
    hex: '#E5CDBD'
  }, {
    name: 'Navy',
    hex: '#2D313F'
  }, {
    name: 'Paperwhite',
    hex: '#F7F7F5'
  }];
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      background: 'rgba(33,32,31,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      animation: 'qFadeIn 200ms ease-out'
    }
  }, /*#__PURE__*/React.createElement("style", null, `@keyframes qFadeIn { from { opacity: 0;} to { opacity: 1;} }
               @keyframes qRiseIn { from { opacity: 0; transform: translateY(16px);} to { opacity: 1; transform: none;} }`), /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      maxWidth: 920,
      width: '100%',
      maxHeight: '86vh',
      background: '#fff',
      borderRadius: 2,
      overflow: 'hidden',
      boxShadow: 'var(--shadow-below)',
      animation: 'qRiseIn 300ms ease-in-out'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      background: 'var(--color-paperwhite)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: product.image,
    alt: product.title,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block'
    }
  }), product.badge && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 16,
      left: 16
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    variant: "trans"
  }, product.badge))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '36px 36px 28px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      overflowY: 'auto',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      position: 'absolute',
      top: 14,
      right: 14,
      background: 'transparent',
      border: 0,
      cursor: 'pointer',
      padding: 6,
      color: 'var(--color-darkgray)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "close"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Caps, {
    size: "xs",
    style: {
      color: 'var(--color-mediumgray)'
    }
  }, product.category || 'Women · Cashmere'), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(Rich, {
    size: "lg"
  }, product.title)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      display: 'flex',
      gap: 10,
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      alignItems: 'baseline',
      fontVariantNumeric: 'tabular-nums'
    }
  }, /*#__PURE__*/React.createElement("span", null, "$", product.price.toFixed(2)), product.compareAt && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-silvergray)',
      textDecoration: 'line-through'
    }
  }, "$", product.compareAt.toFixed(2)))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 13,
      lineHeight: '20px',
      color: 'var(--color-gray)',
      margin: 0
    }
  }, "100% Mongolian cashmere knit in Inner Mongolia. Mid-weight at 14-gauge, relaxed crewneck, ribbed cuffs."), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(Caps, {
    size: "xs"
  }, "Color: ", /*#__PURE__*/React.createElement("span", {
    style: {
      textTransform: 'none',
      fontWeight: 400,
      color: 'var(--color-gray)'
    }
  }, colors[color].name))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, colors.map((c, i) => /*#__PURE__*/React.createElement("button", {
    key: c.name,
    onClick: () => setColor(i),
    style: {
      width: 28,
      height: 28,
      padding: 0,
      borderRadius: 9999,
      border: i === color ? '1px solid var(--color-darkgray)' : '1px solid var(--color-lightgray)',
      background: '#fff',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 20,
      height: 20,
      borderRadius: 9999,
      background: c.hex
    }
  }))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 8,
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement(Caps, {
    size: "xs"
  }, "Size"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 11,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: 'var(--color-darkgray)',
      borderBottom: '1px solid var(--color-darkgray)',
      textDecoration: 'none',
      paddingBottom: 1
    }
  }, "Size guide")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, ['XS', 'S', 'M', 'L', 'XL'].map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    onClick: () => setSize(s),
    style: {
      flex: 1,
      height: 42,
      background: '#fff',
      border: `1px solid ${s === size ? 'var(--color-darkgray)' : 'var(--color-lightgray)'}`,
      borderRadius: 2,
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: '0.05em',
      color: 'var(--color-darkgray)'
    }
  }, s)))), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    full: true,
    onClick: () => onAdd({
      ...product,
      size,
      color: colors[color].name
    })
  }, "Add to bag \xB7 $", product.price.toFixed(2)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: 'var(--font-sans)',
      fontSize: 11,
      color: 'var(--color-mediumgray)',
      letterSpacing: '0.02em'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "truck",
    size: 16
  }), /*#__PURE__*/React.createElement("span", null, "Free shipping over $75 \xB7 easy returns within 365 days")))));
};
const CartDrawer = ({
  open,
  items,
  onClose,
  onRemove
}) => {
  const total = items.reduce((s, it) => s + it.price * it.qty, 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 40,
      pointerEvents: open ? 'auto' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(33,32,31,0.4)',
      opacity: open ? 1 : 0,
      transition: 'opacity 200ms ease-out'
    }
  }), /*#__PURE__*/React.createElement("aside", {
    style: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: 420,
      background: '#fff',
      transform: open ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 300ms ease-in-out',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: 'var(--shadow-below)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '20px 24px',
      borderBottom: '1px solid var(--color-lightgray)'
    }
  }, /*#__PURE__*/React.createElement(Caps, {
    size: "base"
  }, "Your Bag (", items.length, ")"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'transparent',
      border: 0,
      cursor: 'pointer',
      padding: 6,
      color: 'var(--color-darkgray)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "close"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '8px 24px'
    }
  }, items.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '80px 20px',
      color: 'var(--color-mediumgray)'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      margin: 0
    }
  }, "Nothing here yet \u2014"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      margin: '4px 0 20px'
    }
  }, "start with new arrivals."), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "md",
    onClick: onClose
  }, "Continue shopping")), items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'grid',
      gridTemplateColumns: '80px 1fr auto',
      gap: 14,
      padding: '16px 0',
      borderBottom: '1px solid var(--color-lightgray)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      aspectRatio: '4 / 5',
      background: 'var(--color-paperwhite)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: it.image,
    alt: it.title,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--color-darkgray)',
      lineHeight: '16px'
    }
  }, it.title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--color-mediumgray)',
      letterSpacing: '0.02em'
    }
  }, it.color, " \xB7 ", it.size, " \xB7 Qty ", it.qty), /*#__PURE__*/React.createElement("button", {
    onClick: () => onRemove(i),
    style: {
      background: 'transparent',
      border: 0,
      cursor: 'pointer',
      padding: 0,
      fontFamily: 'var(--font-sans)',
      fontSize: 11,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: 'var(--color-mediumgray)',
      textAlign: 'left',
      borderBottom: '1px solid var(--color-lightgray)',
      paddingBottom: 1,
      alignSelf: 'flex-start',
      marginTop: 4
    }
  }, "Remove")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 13,
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--color-darkgray)'
    }
  }, "$", (it.price * it.qty).toFixed(2))))), items.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24,
      borderTop: '1px solid var(--color-lightgray)',
      boxShadow: 'var(--shadow-above)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 16,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement(Caps, {
    size: "sm"
  }, "Subtotal"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontVariantNumeric: 'tabular-nums'
    }
  }, "$", total.toFixed(2))), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    full: true
  }, "Checkout"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 11,
      color: 'var(--color-mediumgray)',
      textAlign: 'center',
      margin: '12px 0 0',
      letterSpacing: '0.02em'
    }
  }, "Free shipping on orders over $75"))));
};
Object.assign(window, {
  QuickView,
  CartDrawer
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/storefront/QuickView.jsx", error: String((e && e.message) || e) }); }

})();
