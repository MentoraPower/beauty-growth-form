import { cn } from '@/lib/utils';
import React from 'react';

type FeatureType = {
	title: string;
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	description: string;
};

type FeatureCardPorps = React.ComponentProps<'div'> & {
	feature: FeatureType;
};

export function FeatureCard({ feature, className, ...props }: FeatureCardPorps) {
	const p = React.useMemo(() => genRandomPattern(), []);

	return (
		<div className={cn('relative group', className)} {...props}>
			{/* Corner squares - outside the overflow-hidden container */}
			<div className="absolute -top-1 -left-1 w-2 h-2 border border-white/30 z-10 bg-white/20" />
			<div className="absolute -top-1 -right-1 w-2 h-2 border border-white/30 z-10 bg-white/20" />
			<div className="absolute -bottom-1 -left-1 w-2 h-2 border border-white/30 z-10 bg-white/20" />
			<div className="absolute -bottom-1 -right-1 w-2 h-2 border border-white/30 z-10 bg-white/20" />
			
			{/* Card content with red gradient background */}
			<div className="relative p-6 overflow-hidden h-full bg-gradient-to-br from-[#F40000] to-[#A10000] rounded-lg">
				<div className="pointer-events-none absolute top-0 left-1/2 -mt-2 -ml-20 h-full w-full overflow-hidden [mask-image:linear-gradient(white,transparent)]">
					<div className="from-white/10 to-white/5 absolute inset-0 bg-gradient-to-r [mask-image:radial-gradient(farthest-side_at_top,white,transparent)] opacity-100">
						<GridPattern
							width={20}
							height={20}
							x="-12"
							y="4"
							squares={p}
							className="fill-white/10 stroke-white/20 absolute inset-0 h-full w-full mix-blend-overlay"
						/>
					</div>
				</div>
				<feature.icon className="text-white size-7 md:size-8 relative z-10" strokeWidth={1.5} aria-hidden />
			<h3 className="mt-8 text-lg md:text-xl lg:text-2xl font-bold text-white relative z-10">{feature.title}</h3>
			<p className="text-white/90 relative z-20 mt-3 text-sm md:text-base font-light leading-relaxed">{feature.description}</p>
			</div>
		</div>
	);
}

function GridPattern({
	width,
	height,
	x,
	y,
	squares,
	...props
}: React.ComponentProps<'svg'> & { width: number; height: number; x: string; y: string; squares?: number[][] }) {
	const patternId = React.useId();

	return (
		<svg aria-hidden="true" {...props}>
			<defs>
				<pattern id={patternId} width={width} height={height} patternUnits="userSpaceOnUse" x={x} y={y}>
					<path d={`M.5 ${height}V.5H${width}`} fill="none" />
				</pattern>
			</defs>
			<rect width="100%" height="100%" strokeWidth={0} fill={`url(#${patternId})`} />
			{squares && (
				<svg x={x} y={y} className="overflow-visible">
					{squares.map(([x, y], index) => (
						<rect strokeWidth="0" key={index} width={width + 1} height={height + 1} x={x * width} y={y * height} />
					))}
				</svg>
			)}
		</svg>
	);
}

function genRandomPattern(length?: number): number[][] {
	length = length ?? 5;
	return Array.from({ length }, () => [
		Math.floor(Math.random() * 4) + 7,
		Math.floor(Math.random() * 6) + 1,
	]);
}
