export default function AlertBanner({ clients, onSelect }) {
  const names = clients.map(c => c.name).join(', ')

  return (
    <div className="alert-banner">
      <span className="alert-banner-icon">🚨</span>
      <span className="alert-banner-text">
        <strong>FA-Übermittlung fällig!</strong>{' '}
        Folgende Mandate haben ein überschrittenes Übermittlungsdatum:{' '}
        {clients.map((c, i) => (
          <span key={c.id}>
            {i > 0 && ', '}
            <strong
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => onSelect(c.id)}
            >
              {c.name}
            </strong>
          </span>
        ))}
      </span>
    </div>
  )
}
