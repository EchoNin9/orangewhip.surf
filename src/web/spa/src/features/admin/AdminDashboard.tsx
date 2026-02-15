import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MusicalNoteIcon,
  CalendarIcon,
  MapPinIcon,
  NewspaperIcon,
  DocumentTextIcon,
  UserGroupIcon,
  UsersIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import {
  useAuth,
  hasRole,
  canManageMedia,
  canEditContent,
  canAdminister,
  canManageUsers,
} from "../../shell/AuthContext";
import { useEffect } from "react";

/* ------------------------------------------------------------------ */
/*  Module cards config                                               */
/* ------------------------------------------------------------------ */

interface ModuleCard {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  visible: (user: ReturnType<typeof useAuth>["user"]) => boolean;
}

const modules: ModuleCard[] = [
  {
    title: "Media Management",
    description: "Upload and organize audio, video, and images.",
    icon: MusicalNoteIcon,
    to: "/admin/media",
    visible: (u) => canManageMedia(u),
  },
  {
    title: "Shows Management",
    description: "Create and manage upcoming shows and past gigs.",
    icon: CalendarIcon,
    to: "/admin/shows",
    visible: (u) => canEditContent(u),
  },
  {
    title: "Venues",
    description: "Add and manage venues for shows.",
    icon: MapPinIcon,
    to: "/admin/venues",
    visible: (u) => canEditContent(u),
  },
  {
    title: "Updates Management",
    description: "Post band news and announcements.",
    icon: NewspaperIcon,
    to: "/admin/updates",
    visible: (u) => canManageMedia(u),
  },
  {
    title: "Press Management",
    description: "Manage press kits, attachments, and links.",
    icon: DocumentTextIcon,
    to: "/admin/press",
    visible: (u) => canEditContent(u),
  },
  {
    title: "Membership",
    description: "Manage custom groups and member access.",
    icon: UserGroupIcon,
    to: "/admin/membership",
    visible: (u) => hasRole(u, "manager"),
  },
  {
    title: "Users",
    description: "Manage user accounts, roles, and group assignments.",
    icon: UsersIcon,
    to: "/admin/users",
    visible: (u) => canManageUsers(u),
  },
  {
    title: "API Keys",
    description: "Create and revoke API access keys.",
    icon: KeyIcon,
    to: "/admin/api-keys",
    visible: (u) => canAdminister(u),
  },
];

/* ------------------------------------------------------------------ */
/*  Animation                                                         */
/* ------------------------------------------------------------------ */

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function AdminDashboard() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) navigate("/login");
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="container-max section-padding text-center">
        <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || (!canEditContent(user) && !canManageMedia(user))) {
    return (
      <div className="container-max section-padding text-center">
        <h1 className="text-2xl font-display font-bold text-secondary-100 mb-4">
          Access Denied
        </h1>
        <p className="text-secondary-400">
          You don&rsquo;t have permission to access the admin area.
        </p>
      </div>
    );
  }

  const visibleModules = modules.filter((m) => m.visible(user));

  return (
    <main className="container-max section-padding">
      <motion.h1
        className="text-4xl sm:text-5xl font-display font-bold text-gradient mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Admin
      </motion.h1>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {visibleModules.map((mod) => (
          <motion.div key={mod.to} variants={fadeUp}>
            <Link
              to={mod.to}
              className="card block p-6 hover:border-primary-500/50 transition-colors group"
            >
              <mod.icon className="w-8 h-8 text-primary-500 mb-4 group-hover:scale-110 transition-transform" />
              <h2 className="text-lg font-display font-bold text-secondary-100 mb-1">
                {mod.title}
              </h2>
              <p className="text-sm text-secondary-400">{mod.description}</p>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </main>
  );
}
