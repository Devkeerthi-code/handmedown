export default function Loading() {
  return (
    <div className="container page" aria-busy="true" aria-label="Loading listing">
      <div className="sk" style={{ height: 20, width: 140, marginBottom: 16 }} />
      <div className="detail">
        <div className="sk" style={{ aspectRatio: "1 / .9", borderRadius: 16 }} />
        <div className="detail__info">
          <div className="sk" style={{ height: 32, width: "80%" }} />
          <div className="sk" style={{ height: 28, width: "30%" }} />
          <div className="facts">
            <div className="sk" style={{ height: 64 }} />
            <div className="sk" style={{ height: 64 }} />
          </div>
          <div className="sk" style={{ height: 72 }} />
          <div className="sk" style={{ height: 52, borderRadius: 999 }} />
        </div>
      </div>
    </div>
  );
}
