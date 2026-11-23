import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { Card } from "./Surfaces";
import { cn } from "./beui/utils";

export function PageStack({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("ui-page-stack", className)} />;
}

type HeadingProps = {
  title: ReactNode; description?: ReactNode; actions?: ReactNode;
  level?: 2 | 3; className?: string;
};

export function SectionHeading({ title, description, actions, level = 2, className }: HeadingProps) {
  const Heading = level === 3 ? "h3" : "h2";
  return <div className={cn("section-heading ui-section-heading", className)}>
    <div className="ui-section-intro">
      <Heading>{title}</Heading>
      {description && <div className="ui-section-description">{description}</div>}
    </div>
    {actions && <div className="ui-heading-actions">{actions}</div>}
  </div>;
}

export function SectionCard({ title, description, actions, level, className, children, ...props }:
  Omit<ComponentProps<typeof Card>, "title"> & HeadingProps) {
  return <Card {...props} className={cn("ui-section-card", className)}>
    <SectionHeading title={title} description={description} actions={actions} level={level} />
    {children}
  </Card>;
}

export function EmptyState({ title, description, children, className, icon }:
  { title: ReactNode; description?: ReactNode; children?: ReactNode; className?: string; icon?: ReactNode }) {
  return <div className={cn("ui-empty-state", className)}>
    {icon && <div className="ui-empty-icon" aria-hidden="true">{icon}</div>}
    <h3 className="ui-empty-title">{title}</h3>
    {description && <p className="ui-empty-description">{description}</p>}
    {children && <div className="ui-empty-actions">{children}</div>}
  </div>;
}
