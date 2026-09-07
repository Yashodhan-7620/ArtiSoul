import Icon from './Icon';

export default function EmptyState({ icon = 'box', title, message, action = null }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-3xl bg-cream-200 text-clay-400">
        <Icon name={icon} className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <h3 className="mt-4 font-display text-[18px] font-semibold text-ink-800">{title}</h3>
      {message && <p className="mt-1.5 max-w-[30ch] text-[14px] leading-relaxed text-ink-400">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
