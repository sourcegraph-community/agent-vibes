import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard - AgentVibes',
  description: 'Real-time intelligence feed for the coding agent ecosystem',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
