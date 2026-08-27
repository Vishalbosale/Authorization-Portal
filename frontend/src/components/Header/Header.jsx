import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";


import {
    Link,
    NavLink,
    useLocation,
    useNavigate
} from "react-router-dom";


import {
    ChevronDown,
    ClipboardList,
    FileCheck2,
    FilePlus2,
    Home as HomeIcon,
    LogOut,
    Menu,
    PieChart,
    Route as RouteIcon,
    Settings2,
    UserRound,
    X
} from "lucide-react";


import {
    useAuth
} from "../../context/AuthContext";


import {
    useRequests
} from "../../context/RequestsContext";


import {
    useRevocations
} from "../../context/RevocationsContext";


import {
    ROLE_BUCKETS
} from "../../data/workflow";


import {
    REVOCATION_APPROVER_ROLES,
    countPendingRevocations,
    selectVisibleRevocations
} from "../../data/revocation";


import axisLogo from "../../assets/axis-dark-logo.svg";


import "./Header.css";


function Header() {

    const {
        user,
        logout
    } = useAuth();

    const { requests } = useRequests();

    const { revocations } = useRevocations();

    const navigate = useNavigate();
    const location = useLocation();

    const [profileOpen, setProfileOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(() => window.scrollY > 4);
    const [lastPath, setLastPath] = useState(location.pathname);

    const profileRef = useRef(null);


    // Any navigation closes whatever was open. Adjusting during render
    // rather than in an effect avoids a second paint with the menu still up.
    if (lastPath !== location.pathname) {
        setLastPath(location.pathname);
        setProfileOpen(false);
        setMenuOpen(false);
    }


    // Elevate the header once the page scrolls away from the top.
    useEffect(() => {

        const onScroll = () => setScrolled(window.scrollY > 4);

        window.addEventListener("scroll", onScroll, { passive: true });

        return () => window.removeEventListener("scroll", onScroll);

    }, []);


    // Dismiss the profile menu on an outside click or Escape.
    useEffect(() => {

        if (!profileOpen) {
            return;
        }

        const onPointerDown = (event) => {

            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setProfileOpen(false);
            }

        };

        const onKeyDown = (event) => {

            if (event.key === "Escape") {
                setProfileOpen(false);
            }

        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);

        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };

    }, [profileOpen]);


    const handleLogout = async () => {

        await logout();

        setProfileOpen(false);
        navigate("/login");

    };


    // Everything waiting on this approver, whichever queue it sits in: their
    // request bucket (letter issuance included, for Secretarial) plus any
    // revocation awaiting their approval. One badge, one number to clear.
    const pendingCount = useMemo(() => {

        if (!user || user.role === "MAKER") {
            return 0;
        }

        const isAdmin = user.role === "ADMIN";

        const stages = isAdmin
            ? Object.values(ROLE_BUCKETS).flat()
            : ROLE_BUCKETS[user.role] || [];

        const pendingRequests = requests.filter(
            (request) => stages.includes(request.status)
        ).length;

        // Only Secretarial and the ORMD Head approve revocations; a HOD raises
        // them, so a HOD has nothing pending here.
        if (!isAdmin && !REVOCATION_APPROVER_ROLES.includes(user.role)) {
            return pendingRequests;
        }

        const pendingRevocations = countPendingRevocations(
            selectVisibleRevocations({
                revocations,
                actingRole: user.role,
                isAdmin,
                employeeId: user.employeeId
            }),
            user.role,
            isAdmin
        );

        return pendingRequests + pendingRevocations;

    }, [user, requests, revocations]);


    const navItems = [
        { to: "/", label: "Home", icon: HomeIcon, end: true },
        { to: "/request", label: "Request", icon: FilePlus2 },
        { to: "/workflow", label: "Workflow", icon: RouteIcon },
        user && { to: "/my-requests", label: "My Requests", icon: ClipboardList },
        user && user.role !== "MAKER" && {
            to: "/checker",
            label: "Approvals",
            icon: FileCheck2,
            count: pendingCount,
            title: "Requests and revocations awaiting your approval"
        },
        { to: "/report", label: "Reports", icon: PieChart },
        user && user.role === "ADMIN" && { to: "/admin", label: "Admin", icon: Settings2 }
    ].filter(Boolean);


    return (

        <header
            className={
                scrolled
                    ? "main-header is-scrolled"
                    : "main-header"
            }
        >

            <div className="header-main-row">

                <Link to="/" className="header-brand">

                    <img
                        className="header-logo"
                        src={axisLogo}
                        alt="Axis Finance"
                    />

                    <span className="header-brand-divider" />

                    <span className="header-brand-caption">
                        Authorization
                        <strong>Portal</strong>
                    </span>

                </Link>


                <button
                    className="header-menu-toggle"
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label={menuOpen ? "Close menu" : "Open menu"}
                    aria-expanded={menuOpen}
                >
                    {menuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>


                <nav
                    className={
                        menuOpen
                            ? "header-navigation is-open"
                            : "header-navigation"
                    }
                >

                    {navItems.map((item, index) => {

                        const Icon = item.icon;

                        return (

                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                title={item.title}
                                className="header-nav-link"
                                style={{ "--nav-index": index }}
                            >

                                <Icon size={15} strokeWidth={2} />

                                <span>{item.label}</span>

                                {item.count > 0 && (
                                    <span className="header-nav-count">
                                        {item.count}
                                    </span>
                                )}

                            </NavLink>

                        );

                    })}


                    {user ? (

                        <div className="profile-container" ref={profileRef}>

                            <button
                                className={
                                    profileOpen
                                        ? "profile-button is-open"
                                        : "profile-button"
                                }
                                onClick={() => setProfileOpen(!profileOpen)}
                                aria-expanded={profileOpen}
                            >

                                <span className="profile-avatar">
                                    {user.employeeName?.charAt(0).toUpperCase()}
                                </span>

                                <span className="profile-name">
                                    {user.employeeName}
                                </span>

                                <ChevronDown
                                    className="profile-chevron"
                                    size={15}
                                />

                            </button>


                            {profileOpen && (

                                <div className="profile-dropdown">

                                    <div className="profile-info">

                                        <span className="profile-info-avatar">
                                            {user.employeeName?.charAt(0).toUpperCase()}
                                        </span>

                                        <div>

                                            <strong>{user.employeeName}</strong>

                                            <span>ID: {user.employeeId}</span>

                                            <span>{user.department}</span>

                                            <span>{user.designation}</span>

                                            {user.role && (
                                                <span className="profile-role-badge">
                                                    {user.roleName || user.role}
                                                </span>
                                            )}

                                        </div>

                                    </div>


                                    <div className="profile-dropdown-actions">

                                        <Link
                                            to="/profile"
                                            onClick={() => setProfileOpen(false)}
                                        >
                                            <UserRound size={15} />
                                            My Profile
                                        </Link>

                                        <button onClick={handleLogout}>
                                            <LogOut size={15} />
                                            Logout
                                        </button>

                                    </div>

                                </div>

                            )}

                        </div>

                    ) : (

                        <Link to="/login" className="login-header-button">
                            Sign In
                        </Link>

                    )}

                </nav>

            </div>

        </header>

    );

}


export default Header;
