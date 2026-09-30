export default function Navbar({
  user,
  isAdmin,
  route,
  mobileNav,
  logout,
  Icon,
}) {
  const links = user
    ? isAdmin
      ? [
          ["/admin", "Admin", "plan"],
          ["/courses", "Courses", "book"],
        ]
      : [
          ["/dashboard", "Dashboard", "home"],
          ["/courses", "Courses", "book"],
          ["/plan", "My plan", "plan"],
        ]
    : [
        ["/", "Home", "home"],
        ["/courses", "Browse courses", "book"],
      ];

  return (
    <nav className={`main-nav ${mobileNav ? "nav-open" : ""}`}>
      {links.map(([path, label, icon]) => (
        <a
          key={path}
          className={
            route === path || (path !== "/" && route.startsWith(path))
              ? "active"
              : ""
          }
          href={`#${path}`}
        >
          <Icon name={icon} />
          {label}
        </a>
      ))}
      {user && (
        <a className="mobile-only" href="#/notifications">
          <Icon name="bell" />
          Notifications
        </a>
      )}
      {user && (
        <button className="mobile-only nav-logout" onClick={logout}>
          <Icon name="logout" />
          Log out
        </button>
      )}
    </nav>
  );
}
