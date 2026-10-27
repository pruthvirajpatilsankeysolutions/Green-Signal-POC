import * as L from "lucide-react";

// The icons Story Studio uses, drawn the way the design draws them: the "ic" class sets the size, and the line is 1.6 thick.
const wrap = (Icon) => function StudioIcon(props) { return <Icon className="ic" strokeWidth={1.6} aria-hidden="true" {...props} />; };

export const AlertCircle = wrap(L.AlertCircle);
export const AlertTriangle = wrap(L.AlertTriangle);
export const ArrowUpDown = wrap(L.ArrowUpDown);
export const BookMarked = wrap(L.BookMarked);
export const BookOpen = wrap(L.BookOpen);
export const Check = wrap(L.Check);
export const CheckCircle2 = wrap(L.CheckCircle2);
export const ChevronDown = wrap(L.ChevronDown);
export const ChevronLeft = wrap(L.ChevronLeft);
export const Clapperboard = wrap(L.Clapperboard);
export const Clock = wrap(L.Clock);
export const Copy = wrap(L.Copy);
export const Download = wrap(L.Download);
export const Feather = wrap(L.Feather);
export const FileText = wrap(L.FileText);
export const HelpCircle = wrap(L.HelpCircle);
export const Languages = wrap(L.Languages);
export const Layers = wrap(L.Layers);
export const ListChecks = wrap(L.ListChecks);
export const LogOut = wrap(L.LogOut);
export const MoreHorizontal = wrap(L.MoreHorizontal);
export const PenLine = wrap(L.PenLine);
export const Pencil = wrap(L.Pencil);
export const Plus = wrap(L.Plus);
export const RotateCcw = wrap(L.RotateCcw);
export const Search = wrap(L.Search);
export const Settings = wrap(L.Settings);
export const ShieldCheck = wrap(L.ShieldCheck);
export const ShieldOff = wrap(L.ShieldOff);
export const Trash2 = wrap(L.Trash2);
export const Undo2 = wrap(L.Undo2);
export const UserCheck = wrap(L.UserCheck);
export const X = wrap(L.X);
