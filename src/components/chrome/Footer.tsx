import Link from "next/link";
import { CAMPUS } from "@/config/campus";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__cols">
          <p className="footer__about">
            <b style={{ color: "#fff", display: "block", marginBottom: 8 }}>HandMeDown</b>A buy, sell and give-away
            board for students of {CAMPUS.name}. Run by students, not by the college office.
          </p>
          <div>
            <h3>Browse</h3>
            <ul>
              <li><Link href="/?category=books#listings">Books</Link></li>
              <li><Link href="/?category=cycles#listings">Cycles</Link></li>
              <li><Link href="/?category=hostel#listings">Hostel essentials</Link></li>
              <li><Link href="/sell">Sell an item</Link></li>
            </ul>
          </div>
          <div>
            <h3>Safety</h3>
            <ul>
              <li><Link href="/#how">Meet at a campus spot</Link></li>
              <li><Link href="/#how">Why chats stay in-app</Link></li>
              <li><Link href="/chats">Blocking someone</Link></li>
            </ul>
          </div>
          <div>
            <h3>Help</h3>
            <ul>
              <li><Link href="/#how">How it works</Link></li>
              <li><Link href="/account">Verify your college email</Link></li>
              <li><Link href="/alerts">Wishlist alerts</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer__base">
          <span>Listings marked DEMO are examples, not real items.</span>
          <span>No phone numbers needed. Ever.</span>
        </div>
      </div>
    </footer>
  );
}
