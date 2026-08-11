interface SubscriptionBadgeProps {
  planName: string;
}

export function SubscriptionBadge({ planName }: SubscriptionBadgeProps) {
  return (
    <span className="subscription-badge">
      <span className="subscription-badge__dot" />
      {planName}
    </span>
  );
}