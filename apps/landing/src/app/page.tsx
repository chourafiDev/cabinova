import { Cta } from "@/components/landing/cta";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Navbar } from "@/components/landing/navbar";
import { Pricing } from "@/components/landing/pricing";
import { Security } from "@/components/landing/security";
import { Specialties } from "@/components/landing/specialties";
import { Testimonials } from "@/components/landing/testimonials";

/** cabinova.ma: the public presentation of the product. */
export default function Home() {
	return (
		<>
			<Navbar />
			<main>
				<Hero />
				<Specialties />
				<Features />
				<HowItWorks />
				<Security />
				<Pricing />
				<Testimonials />
				<Faq />
				<Cta />
			</main>
			<Footer />
		</>
	);
}
