import Link from "next/link";

type FooterCollege = { name: string; base: string };

export function Footer({ college }: { college: FooterCollege | null }) {
  const base = college?.base;
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__cols">
          <p className="footer__about">
            <b style={{ color: "#fff", display: "block", marginBottom: 8 }}>HandMeDown</b>
            {college
              ? `${college.name}'s buy, sell and give-away board. Run by students, not by the college office.`
              : "A buy, sell and give-away board for every college. Each campus gets its own marketplace, run by its students."}
          </p>
          {base ? (
            <div>
              <h3>Browse</h3>
              <ul>
                <li><Link href={`${base}?category=books#listings`}>Books</Link></li>
                <li><Link href={`${base}?category=cycles#listings`}>Cycles</Link></li>
                <li><Link href={`${base}?category=hostel#listings`}>Hostel essentials</Link></li>
                <li><Link href={`${base}/sell`}>Sell an item</Link></li>
              </ul>
            </div>
          ) : (
            <div>
              <h3>Colleges</h3>
              <ul>
                <li><Link href="/#colleges">Find your college</Link></li>
                <li><Link href="/start">Bring HandMeDown to your college</Link></li>
              </ul>
            </div>
          )}
          <div>
            <h3>Safety</h3>
            <ul>
              <li><Link href={base ? `${base}#how` : "/#how"}>Meet at a campus spot</Link></li>
              <li><Link href={base ? `${base}#how` : "/#how"}>Why chats stay in-app</Link></li>
              {base ? <li><Link href={`${base}/chats`}>Blocking someone</Link></li> : null}
            </ul>
          </div>
          <div>
            <h3>Help</h3>
            <ul>
              <li><Link href="/account">Join with your college email</Link></li>
              {base ? <li><Link href={`${base}/alerts`}>Wishlist alerts</Link></li> : null}
              <li><Link href="/">All colleges</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer__base">
          <span>Colleges and listings marked DEMO are examples, not real.</span>
          <span>No phone numbers needed. Ever.</span>
        </div>
      </div>
    </footer>
  );
}
