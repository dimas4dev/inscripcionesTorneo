import { redirect } from 'next/navigation';

export default function UnknownRoute() {
  redirect('/');
}
