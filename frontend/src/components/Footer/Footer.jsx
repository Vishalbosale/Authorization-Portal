import {
    Link
} from "react-router-dom";


import {
    Clock3,
    Mail,
    ShieldCheck
} from "lucide-react";


import "./Footer.css";


function Footer() {

    return (

        <footer className="main-footer">

            <div className="footer-content">

                <div className="footer-brand-column">

                    <strong>Axis Finance</strong>

                    <span>Authorization Management Portal</span>

                    <p>
                        A secure workspace for submitting, reviewing and tracking authorization requests.
                    </p>

                    <span className="footer-secure-note">
                        <ShieldCheck size={14} />
                        Internal use only
                    </span>

                </div>


                <div className="footer-column">

                    <h3>Quick Links</h3>

                    <Link to="/">Home</Link>
                    <Link to="/request">Create Request</Link>
                    <Link to="/my-requests">My Requests</Link>
                    <Link to="/tracking">Track Request</Link>

                </div>


                <div className="footer-column">

                    <h3>Workflow</h3>

                    <Link to="/workflow">Approval Workflow</Link>
                    <Link to="/checker">Approvals</Link>
                    <Link to="/report">Reports</Link>
                    <Link to="/profile">My Profile</Link>

                </div>


                <div className="footer-column footer-contact-column">

                    <h3>Reach Us Here</h3>

                    <span>For portal access and authorization support</span>

                    <a href="mailto:afl.rpa@axisfinance.in">
                        <Mail size={14} />
                        afl.rpa@axisfinance.in
                    </a>

                    <span className="footer-hours">
                        <Clock3 size={14} />
                        Monday - Friday, 9:30 AM - 6:30 PM
                    </span>

                </div>

            </div>


            <div className="footer-bottom">

                <span>
                    © {new Date().getFullYear()} Axis Finance Limited. All rights reserved.
                </span>

                <div>
                    <Link to="/">Privacy Policy</Link>
                    <Link to="/">Terms &amp; Conditions</Link>
                </div>

            </div>

        </footer>

    );

}


export default Footer;
