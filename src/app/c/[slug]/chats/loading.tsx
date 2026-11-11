export default function Loading() {
  return (
    <div className="container page" aria-busy="true" aria-label="Loading chats">
      <div className="chats chats--list">
        <div className="inbox">
          <div className="inbox__head">
            <div className="sk" style={{ height: 24, width: 80 }} />
          </div>
          <div style={{ padding: 8, display: "grid", gap: 8 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="sk" style={{ height: 64, borderRadius: 12 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
