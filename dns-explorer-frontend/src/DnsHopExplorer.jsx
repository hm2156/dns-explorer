import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Server,
  Globe,
  Zap,
  AlertTriangle,
  RefreshCcw,
  Link,
  Database,
  ChevronLeft,
  ChevronRight,
  Clock,
  Network,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
} from "recharts";

// Root IPs for DNS hierarchy visualization
const ROOTS = new Set([
  "198.41.0.4",
  "199.9.14.201",
  "192.33.4.12",
  "199.7.91.13",
  "192.203.230.10",
  "192.5.5.241",
  "192.112.36.4",
  "198.97.190.53",
  "192.36.148.17",
  "192.58.128.30",
  "193.0.14.129",
  "199.7.83.42",
  "202.12.27.33",
]);

// Sample data
const SAMPLE = {
  query: { name: "www.google.com.", type: "A", cache: "off" },
  summary: {
    final_ips: ["172.217.19.36", "142.250.191.4"],
    total_ms: 221.73,
    hops: 3,
    cache_saved_ms: 0,
  },
  trace: [
    {
      step: 1,
      server: "199.7.91.13",
      role: "ns",
      question: { name: "www.google.com.", type: "A" },
      answer: [],
      additional: [],
      authority: [
        {
          name: "com.",
          rdtype: "NS",
          ttl: 172800,
          records: [{ value: "a.gtld-servers.net." }],
        },
      ],
      rtt_ms: 49.52,
      cached: false,
    },
    {
      step: 2,
      server: "192.5.6.30",
      role: "ns",
      question: { name: "www.google.com.", type: "A" },
      answer: [],
      additional: [
        {
          name: "ns1.google.com.",
          rdtype: "A",
          ttl: 172800,
          records: [{ value: "216.239.32.10" }],
        },
      ],
      authority: [
        {
          name: "google.com.",
          rdtype: "NS",
          ttl: 172800,
          records: [{ value: "ns1.google.com." }, { value: "ns2.google.com." }],
        },
      ],
      rtt_ms: 83.33,
      cached: false,
    },
    {
      step: 3,
      server: "216.239.34.10",
      role: "ns",
      question: { name: "www.google.com.", type: "A" },
      answer: [
        {
          name: "www.google.com.",
          rdtype: "A",
          ttl: 300,
          records: [{ value: "172.217.19.36" }, { value: "142.250.191.4" }],
        },
      ],
      additional: [],
      authority: [],
      rtt_ms: 85.58,
      cached: false,
    },
  ],
  cname_chain: [],
};

function detectHopLabel(serverIp, hop) {
  if (serverIp === "cache") return "cache";
  if (ROOTS.has(serverIp)) return "root";
  const hasTldNS = (hop?.authority || []).some(
    (a) => a.name && /^[a-z0-9-]+\.$/i.test(a.name)
  );
  return hasTldNS ? "tld" : "auth";
}

function summarizeHop(hop) {
  const role = detectHopLabel(hop.server, hop);
  const qn = hop?.question?.name || "";
  const qt = hop?.question?.type || "";

  const answers = hop?.answer || [];
  const authority = hop?.authority || [];
  const additional = hop?.additional || [];

  const ips = answers
    .filter((a) => a.rdtype === "A" || a.rdtype === "AAAA")
    .flatMap((a) => (a.records || []).map((r) => r.value));

  const cnames = answers
    .filter((a) => a.rdtype === "CNAME")
    .flatMap((a) => (a.records || []).map((r) => r.value));

  const nsTargets = authority
    .filter((a) => a.rdtype === "NS")
    .flatMap((a) => (a.records || []).map((r) => r.value));

  // More detailed but concise technical information
  const serverType = role.toUpperCase();
  const serverInfo = `${serverType} server \`${hop.server}\``;

  if (hop.cached) {
    return `Cache hit from ${serverInfo} - TTL valid, ${hop.rtt_ms}ms response`;
  }

  if (answers.length > 0) {
    if (ips.length > 0) {
      return `Authoritative answer from ${serverInfo} - resolved to ${
        ips.length
      } A record${ips.length > 1 ? "s" : ""}: ${ips.slice(0, 2).join(", ")}${
        ips.length > 2 ? "..." : ""
      } (${hop.rtt_ms}ms)`;
    } else if (cnames.length > 0) {
      return `CNAME response from ${serverInfo} - canonical name points to \`${cnames[0]}\` (${hop.rtt_ms}ms)`;
    } else {
      return `DNS response from ${serverInfo} - returned resource records (${hop.rtt_ms}ms)`;
    }
  } else {
    if (nsTargets.length > 0) {
      const zone = authority[0]?.name || "domain";
      return `NS referral from ${serverInfo} - delegated ${zone} to ${
        nsTargets.length
      } nameserver${nsTargets.length > 1 ? "s" : ""} (${hop.rtt_ms}ms)`;
    } else {
      return `No response from ${serverInfo} - possible NXDOMAIN or timeout (${
        hop.rtt_ms || "timeout"
      }ms)`;
    }
  }
}

function buildNarration(hops) {
  return (hops || []).map(summarizeHop);
}

function prettyJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

// Enhanced DNS Resolution Animation with professional design and responsive layout
function DnsResolutionAnimation({
  hops,
  isAnimating,
  onNodeHover,
  hoveredNode,
  onStepChange,
  onResolved,
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [packets, setPackets] = useState([]);
  const [finalIPs, setFinalIPs] = useState([]);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  // Reset animation when new data arrives
  useEffect(() => {
    if (isAnimating) {
      setCurrentStep(0);
      setPackets([]);
      setFinalIPs([]);
      setCompletedSteps(new Set());
    }
  }, [isAnimating, hops]);

  // Main animation loop
  useEffect(() => {
    if (!isAnimating || !hops.length) return;

    const timeout = setTimeout(
      () => {
        if (currentStep < hops.length) {
          // Add query packet
          const queryPacket = {
            id: `query-${currentStep}`,
            type: "query",
            step: currentStep,
            startTime: Date.now(),
          };
          setPackets((prev) => [...prev, queryPacket]);

          // Add response packet after delay
          setTimeout(() => {
            const responsePacket = {
              id: `response-${currentStep}`,
              type: "response",
              step: currentStep,
              startTime: Date.now(),
              hasAnswer: (hops[currentStep]?.answer?.length || 0) > 0,
            };
            setPackets((prev) => [...prev, responsePacket]);
            setCompletedSteps((prev) => new Set([...prev, currentStep]));

            // If last hop has A/AAAA answers, extract IPs
            if (responsePacket.hasAnswer && currentStep === hops.length - 1) {
              const answers = hops[currentStep]?.answer || [];
              const ips = answers
                .filter((a) => a.rdtype === "A" || a.rdtype === "AAAA")
                .flatMap((a) => (a.records || []).map((r) => r.value))
                .filter(Boolean);
              setTimeout(() => {
                setFinalIPs(ips);
                onResolved?.(ips);
              }, 400);
            }
          }, 800);

          const next = currentStep + 1;
          setCurrentStep(next);
          onStepChange?.(next);
        }
      },
      currentStep === 0 ? 400 : 1400
    );

    return () => clearTimeout(timeout);
  }, [currentStep, isAnimating, hops]);

  // Clean up old packets
  useEffect(() => {
    const interval = setInterval(() => {
      setPackets((prev) => prev.filter((p) => Date.now() - p.startTime < 3000));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Responsive positioning calculations
  const getResponsiveLayout = () => {
    const totalSteps = Math.max(hops.length, 3);

    // Base dimensions that work well for the animation
    const baseSpacing = 180; // Increased spacing between servers
    const clientX = 80;
    const serverStartX = 200; // Start servers further from client
    const serverY = 180;
    const ipX = serverStartX + (totalSteps - 1) * baseSpacing + 150; // Position IPs after last server

    // Calculate total width needed
    const totalWidth = ipX + 200; // Extra space for IPs and padding

    return {
      totalWidth,
      clientPos: { x: clientX, y: serverY },
      getServerPos: (step) => ({
        x: serverStartX + step * baseSpacing,
        y: serverY,
      }),
      getIPPos: (index, total) => {
        if (total === 1) return { x: ipX, y: serverY };
        const spacing = 50;
        const startY = serverY - ((total - 1) * spacing) / 2;
        return { x: ipX, y: startY + index * spacing };
      },
    };
  };

  const layout = getResponsiveLayout();

  const getRoleColor = (role) => {
    switch (role) {
      case "root":
        return "#3b82f6";
      case "tld":
        return "#8b5cf6";
      case "auth":
        return "#10b981";
      case "cache":
        return "#f59e0b";
      default:
        return "#ffffff";
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "root":
        return "◉";
      case "tld":
        return "⬣";
      case "auth":
        return "◆";
      case "cache":
        return "▣";
      default:
        return "●";
    }
  };

  return (
    <div className="relative w-full bg-gradient-to-br from-gray-900 via-black to-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-8">
        <svg width="100%" height="100%">
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#1f2937"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Horizontally scrollable container */}
      <div
        className="relative overflow-x-auto overflow-y-hidden"
        style={{ minHeight: "400px" }}
      >
        <div
          className="relative p-8"
          style={{ width: `${layout.totalWidth}px`, minHeight: "400px" }}
        >
          <svg
            width={layout.totalWidth}
            height="400"
            className="absolute inset-0"
          >
            {/* Client */}
            <motion.g
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              {/* Client glow effect */}
              <circle
                cx={layout.clientPos.x}
                cy={layout.clientPos.y}
                r="25"
                fill="url(#clientGlow)"
                opacity="0.3"
              />
              <circle
                cx={layout.clientPos.x}
                cy={layout.clientPos.y}
                r="18"
                fill="#000000"
                stroke="#dc2626"
                strokeWidth="3"
              />
              <text
                x={layout.clientPos.x}
                y={layout.clientPos.y + 6}
                textAnchor="middle"
                fontSize="16"
                fill="#dc2626"
                fontWeight="bold"
              >
                ⬢
              </text>
              <text
                x={layout.clientPos.x}
                y={layout.clientPos.y + 30}
                textAnchor="middle"
                fontSize="14"
                fill="#e2e8f0"
                fontWeight="600"
              >
                Client
              </text>
            </motion.g>

            {/* DNS Servers */}
            {hops.map((hop, index) => {
              const pos = layout.getServerPos(index);
              const label = detectHopLabel(hop.server, hop);
              const isActive = currentStep > index;
              const isCompleted = completedSteps.has(index);
              const roleColor = getRoleColor(label);
              const roleIcon = getRoleIcon(label);

              const prevPos =
                index === 0 ? layout.clientPos : layout.getServerPos(index - 1);

              return (
                <motion.g key={`server-${index}`}>
                  {/* Connection line */}
                  <motion.line
                    x1={prevPos.x}
                    y1={prevPos.y}
                    x2={pos.x}
                    y2={pos.y}
                    stroke={isCompleted ? roleColor : "#475569"}
                    strokeWidth="1"
                    strokeDasharray={isCompleted ? "0" : "8,4"}
                    initial={{ pathLength: 0, opacity: 0.3 }}
                    animate={{
                      pathLength: isActive ? 1 : 0,
                      opacity: isActive ? 1 : 0.3,
                      stroke: isCompleted ? roleColor : "#475569",
                    }}
                    transition={{
                      delay: index * 0.8,
                      duration: 0.8,
                      ease: "easeInOut",
                    }}
                  />

                  {/* Server glow effect */}
                  <motion.circle
                    cx={pos.x}
                    cy={pos.y}
                    r="30"
                    fill={roleColor}
                    opacity="0.2"
                    initial={{ scale: 0 }}
                    animate={{ scale: isActive ? 1 : 0 }}
                    transition={{ delay: index * 0.9, duration: 0.4 }}
                  />

                  {/* Server circle */}
                  <motion.circle
                    cx={pos.x}
                    cy={pos.y}
                    r="20"
                    fill="#000000"
                    stroke={isCompleted ? roleColor : "#475569"}
                    strokeWidth="3"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{
                      scale: isActive ? 1 : 0,
                      opacity: isActive ? 1 : 0,
                      stroke: isCompleted ? roleColor : "#475569",
                    }}
                    transition={{ delay: index * 0.9, duration: 0.4 }}
                    onMouseEnter={() => onNodeHover(index)}
                    onMouseLeave={() => onNodeHover(null)}
                    style={{ cursor: "pointer" }}
                  />

                  {/* Server icon */}
                  <motion.text
                    x={pos.x}
                    y={pos.y + 6}
                    textAnchor="middle"
                    fontSize="18"
                    fontWeight="bold"
                    fill={isCompleted ? roleColor : "#6b7280"}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isActive ? 1 : 0 }}
                    transition={{ delay: index * 0.95 }}
                  >
                    {roleIcon}
                  </motion.text>

                  {/* Role label */}
                  <motion.text
                    x={pos.x}
                    y={pos.y - 35}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="600"
                    fill={roleColor}
                    initial={{ opacity: 0, y: pos.y - 25 }}
                    animate={{
                      opacity: isActive ? 1 : 0,
                      y: pos.y - 35,
                    }}
                    transition={{ delay: index * 0.95, duration: 0.3 }}
                  >
                    {label.toUpperCase()} SERVER
                  </motion.text>

                  {/* Server details */}
                  <motion.text
                    x={pos.x}
                    y={pos.y + 45}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#94a3b8"
                    fontFamily="monospace"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isActive ? 1 : 0 }}
                    transition={{ delay: index * 1.0 }}
                  >
                    {hop.server}
                  </motion.text>

                  {/* RTT badge */}
                  <motion.g
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: isCompleted ? 1 : 0,
                      scale: isCompleted ? 1 : 0,
                    }}
                    transition={{ delay: index * 1.2 + 0.5 }}
                  >
                    <rect
                      x={pos.x - 25}
                      y={pos.y + 55}
                      width="50"
                      height="20"
                      rx="10"
                      fill={roleColor}
                      opacity="0.2"
                    />
                    <text
                      x={pos.x}
                      y={pos.y + 67}
                      textAnchor="middle"
                      fontSize="10"
                      fill={roleColor}
                      fontWeight="600"
                    >
                      {hop.rtt_ms}ms
                    </text>
                  </motion.g>

                  {/* Step number */}
                  <motion.circle
                    cx={pos.x - 15}
                    cy={pos.y - 15}
                    r="8"
                    fill={roleColor}
                    initial={{ scale: 0 }}
                    animate={{ scale: isCompleted ? 1 : 0 }}
                    transition={{ delay: index * 1.2 + 0.3 }}
                  />
                  <motion.text
                    x={pos.x - 15}
                    y={pos.y - 11}
                    textAnchor="middle"
                    fontSize="10"
                    fill="white"
                    fontWeight="bold"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isCompleted ? 1 : 0 }}
                    transition={{ delay: index * 1.2 + 0.4 }}
                  >
                    {index + 1}
                  </motion.text>
                </motion.g>
              );
            })}

            {/* Final IP addresses */}
            <AnimatePresence>
              {finalIPs.map((ip, index) => {
                const pos = layout.getIPPos(index, finalIPs.length);
                const lastHopPos = layout.getServerPos(hops.length - 1);
                const isIPv6 = ip.includes(":"); // IPv6 addresses always have ":"
                const offset = isIPv6 ? 120 : 80;

                return (
                  <motion.g key={`ip-${index}`}>
                    {/* Connection line to IPs */}
                    <motion.line
                      x1={lastHopPos.x}
                      y1={lastHopPos.y}
                      x2={pos.x}
                      y2={pos.y}
                      stroke="#10b981"
                      strokeWidth="0.5"
                      strokeDasharray="0"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{
                        delay: 2.5 + index * 0.2,
                        duration: 0.6,
                        ease: "easeOut",
                      }}
                    />

                    {/* IP glow */}
                    <motion.circle
                      cx={pos.x}
                      cy={pos.y}
                      r="20"
                      fill="#10b981"
                      opacity="0.3"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 2.7 + index * 0.2, duration: 0.4 }}
                    />

                    {/* IP node */}
                    <motion.circle
                      cx={pos.x}
                      cy={pos.y}
                      r="15"
                      fill="#1e293b"
                      stroke="#10b981"
                      strokeWidth="2"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 2.7 + index * 0.2, duration: 0.4 }}
                    />

                    {/* Success icon */}
                    <motion.text
                      x={pos.x}
                      y={pos.y + 10}
                      textAnchor="middle"
                      fontSize="20"
                      fill="#10b981"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 2.8 + index * 0.2 }}
                    >
                      *
                    </motion.text>

                    {/* IP address */}
                    <motion.text
                      data-fixed-fill
                      x={pos.x + offset}
                      y={pos.y + 5}
                      textAnchor="middle"
                      fontSize="12"
                      fontFamily="monospace"
                      fontWeight="400"
                      style={{
                        paintOrder: "stroke",
                        fill: "#94a3b8",
                        strokeWidth: 0.5,
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 2.9 + index * 0.2, duration: 0.3 }}
                    >
                      {ip}
                    </motion.text>
                  </motion.g>
                );
              })}
            </AnimatePresence>

            {/* Animated DNS packets */}
            <AnimatePresence>
              {packets.map((packet) => {
                const startPos = layout.clientPos;
                const endPos = layout.getServerPos(packet.step);

                if (packet.type === "query") {
                  return (
                    <motion.g key={packet.id}>
                      <motion.circle
                        r="6"
                        fill="#dc2626"
                        initial={{ cx: startPos.x, cy: startPos.y, opacity: 0 }}
                        animate={{
                          cx: endPos.x,
                          cy: endPos.y,
                          opacity: [0, 1, 1, 0],
                        }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                      />
                      {/* Query trail effect */}
                      <motion.circle
                        r="3"
                        fill="#dc2626"
                        opacity="0.4"
                        initial={{ cx: startPos.x, cy: startPos.y }}
                        animate={{
                          cx: endPos.x,
                          cy: endPos.y,
                          opacity: [0, 0.4, 0],
                        }}
                        transition={{ duration: 1.0, ease: "easeInOut" }}
                      />
                    </motion.g>
                  );
                } else {
                  return (
                    <motion.g key={packet.id}>
                      <motion.circle
                        r="6"
                        fill={packet.hasAnswer ? "#10b981" : "#64748b"}
                        initial={{ cx: endPos.x, cy: endPos.y, opacity: 0 }}
                        animate={{
                          cx: startPos.x,
                          cy: startPos.y,
                          opacity: [0, 1, 1, 0],
                        }}
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                      />
                      {/* Response trail effect */}
                      <motion.circle
                        r="3"
                        fill={packet.hasAnswer ? "#10b981" : "#64748b"}
                        opacity="0.4"
                        initial={{ cx: endPos.x, cy: endPos.y }}
                        animate={{
                          cx: startPos.x,
                          cy: startPos.y,
                          opacity: [0, 0.4, 0],
                        }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                      />
                    </motion.g>
                  );
                }
              })}
            </AnimatePresence>

            {/* SVG Definitions */}
            <defs>
              <radialGradient id="clientGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#dc2626" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>

          {/* Progress indicator */}
          <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-gray-800">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-gray-300">
                Step {Math.min(currentStep, hops.length)} of {hops.length}
              </span>
            </div>
          </div>

          {/* Node details overlay */}
          {hoveredNode !== null && hops[hoveredNode] && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="absolute top-4 right-4 bg-black/90 backdrop-blur-sm border border-gray-800 rounded-lg p-4 min-w-64"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: getRoleColor(
                      detectHopLabel(
                        hops[hoveredNode].server,
                        hops[hoveredNode]
                      )
                    ),
                  }}
                ></div>
                <span className="text-white font-semibold">
                  {detectHopLabel(
                    hops[hoveredNode].server,
                    hops[hoveredNode]
                  ).toUpperCase()}{" "}
                  Server
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="text-gray-300 font-mono">
                  {hops[hoveredNode].server}
                </div>
                <div className="text-gray-400">
                  Response: {hops[hoveredNode].rtt_ms}ms
                </div>
                <div className="text-gray-400">
                  {hops[hoveredNode].answer?.length > 0
                    ? "Resolved"
                    : "Referred"}
                </div>
              </div>
            </motion.div>
          )}

          {/* Resolution complete indicator */}
          {finalIPs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 3.5, duration: 0.5 }}
              className="absolute bottom-4 left-1/2 transform translate-x-1/2 bg-black/80 backdrop-blur-sm border border-gray-800 rounded-lg px-4 py-2"
            >
              <div className="flex items-center gap-2 text-gray-300">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Complete</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Horizontal scroll hint for mobile */}
        <div className="md:hidden absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm border border-gray-800 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 text-gray-400 text-xs">
            <ArrowRight className="w-3 h-3" />
            <span>Scroll to see full flow</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact summary dashboard
function SummaryDashboard({ data }) {
  const summary = data?.summary || {};
  const hops = data?.trace || [];

  const chartData = useMemo(
    () => hops.map((h) => ({ step: h.step, rtt: h.rtt_ms ?? 0 })),
    [hops]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Performance Metrics */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Performance
          </span>
        </div>
        <div className="space-y-2">
          <div>
            <div className="text-2xl font-bold text-foreground">
              {summary.total_ms}ms
            </div>
            <div className="text-xs text-muted-foreground">Total time</div>
          </div>
          <div className="flex gap-4">
            <div>
              <div className="text-lg font-semibold text-primary">
                {summary.hops}
              </div>
              <div className="text-xs text-muted-foreground">Hops</div>
            </div>
            {summary.cache_saved_ms > 0 && (
              <div>
                <div className="text-lg font-semibold text-primary">
                  {summary.cache_saved_ms}ms
                </div>
                <div className="text-xs text-muted-foreground">Saved</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RTT Chart */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Response Times
          </span>
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="step" stroke="#a3a3a3" tick={{ fontSize: 10 }} />
              <YAxis
                stroke="#a3a3a3"
                tick={{ fontSize: 10 }}
                domain={["auto", "auto"]}
              />
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <RTooltip
                contentStyle={{
                  backgroundColor: "#0a0a0a",
                  borderColor: "#262626",
                  color: "#fff",
                }}
              />
              <Area
                type="monotone"
                dataKey="rtt"
                stroke="#dc2626"
                fillOpacity={1}
                fill="url(#chartGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Final Results */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Resolution
          </span>
        </div>
        <div className="space-y-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Query</div>
            <div className="font-mono text-sm text-foreground">
              {data?.query?.name} {data?.query?.type}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              IPs ({summary.final_ips?.length || 0})
            </div>
            <div className="space-y-1">
              {summary.final_ips?.slice(0, 2).map((ip, i) => (
                <div
                  key={i}
                  className="bg-primary/10 text-primary rounded px-2 py-1 font-mono text-xs"
                >
                  {ip}
                </div>
              )) || (
                <div className="text-muted-foreground text-xs">
                  No IPs resolved
                </div>
              )}
              {summary.final_ips?.length > 2 && (
                <div className="text-xs text-muted-foreground">
                  +{summary.final_ips.length - 2} more
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Details modal
function DetailsModal({ openHop, onClose }) {
  if (!openHop) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            Hop {openHop.step} Details
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {["question", "answer", "authority", "additional"].map((section) => (
            <div key={section}>
              <h3 className="text-sm font-medium text-primary mb-2 capitalize">
                {section}
              </h3>
              <pre className="text-xs bg-muted text-muted-foreground p-3 rounded border overflow-auto max-h-32">
                {prettyJson(openHop[section])}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DnsHopExplorer() {
  // Apply the dark theme styles
  React.useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      * {
        border-color: rgb(38 38 38);
      }
      
      body {
        background-color: #000000 !important;
        color: #ffffff !important;
      }
      
      .bg-background { background-color: #000000 !important; }
      .bg-card { background-color: #0a0a0a !important; }
      .bg-muted { background-color: #171717 !important; }
      .bg-primary { background-color: #dc2626 !important; }
      .bg-input { background-color: #0a0a0a !important; }
      .bg-destructive { background-color: #dc2626 !important; }
      
      .text-foreground { color: #ffffff !important; }
      .text-card-foreground { color: #ffffff !important; }
      .text-muted-foreground { color: #a3a3a3 !important; }
      .text-primary { color: #dc2626 !important; }
      .text-primary-foreground { color: #ffffff !important; }
      .text-destructive { color: #dc2626 !important; }
      
      .border-border { border-color: #262626 !important; }
      .border-input { border-color: #262626 !important; }
      .border-primary { border-color: #dc2626 !important; }
      .border-destructive { border-color: #dc2626 !important; }
      
      .hover\\:bg-muted\\/80:hover { background-color: rgba(23, 23, 23, 0.8) !important; }
      .hover\\:bg-muted\\/50:hover { background-color: rgba(23, 23, 23, 0.5) !important; }
      .hover\\:bg-primary\\/90:hover { background-color: rgba(220, 38, 38, 0.9) !important; }
      .hover\\:text-foreground:hover { color: #ffffff !important; }
      
      .bg-primary\\/10 { background-color: rgba(220, 38, 38, 0.1) !important; }
      .bg-destructive\\/10 { background-color: rgba(220, 38, 38, 0.1) !important; }
      .border-destructive\\/20 { border-color: rgba(220, 38, 38, 0.2) !important; }
      
      .focus\\:ring-1:focus { box-shadow: 0 0 0 1px #dc2626 !important; }
      .focus\\:outline-none:focus { outline: none !important; }
      
      .disabled\\:bg-muted:disabled { background-color: #171717 !important; }
      
      .fill-foreground { fill: #ffffff !important; }
      .fill-muted-foreground { fill: #a3a3a3 !important; }
      .fill-primary { fill: #dc2626 !important; }
      
      input, select, textarea {
        background-color: #0a0a0a !important;
        color: #ffffff !important;
        border-color: #262626 !important;
      }
      
      input::placeholder, textarea::placeholder {
        color: #737373 !important;
      }
      
      button {
        transition: all 0.2s ease !important;
      }
      
      /* Chart styling */
      .recharts-cartesian-grid-horizontal line,
      .recharts-cartesian-grid-vertical line {
        stroke: #262626 !important;
      }
      
      .recharts-text {
        fill: #a3a3a3 !important;
      }
    `;
    document.head.appendChild(style);

    // Apply dark theme to document
    document.documentElement.style.backgroundColor = "#000000";
    document.body.style.backgroundColor = "#000000";
    document.body.style.color = "#ffffff";

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [baseUrl, setBaseUrl] = useState("https://dns-explorer.onrender.com");
  const [name, setName] = useState("www.google.com");
  const [rtype, setRtype] = useState("A");
  const [useCache, setUseCache] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [openHop, setOpenHop] = useState(null);
  const [jsonText, setJsonText] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [showLearnMore, setShowLearnMore] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const hops = useMemo(
    () => (Array.isArray(data?.trace) ? data.trace : []),
    [data]
  );
  const [animStep, setAnimStep] = useState(0);
  const [animResolvedIPs, setAnimResolvedIPs] = useState([]);
  const narrationLines = useMemo(() => buildNarration(hops), [hops]);

  const resetAnimation = () => {
    setIsAnimating(false);
    setAnimStep(0);
    setAnimResolvedIPs([]);
    setTimeout(() => setIsAnimating(true), 100);
  };

  async function runQuery() {
    setLoading(true);
    setError("");
    setIsAnimating(false);
    setAnimStep(0);
    setAnimResolvedIPs([]);
    setData(null);

    try {
      const url = `${baseUrl}/resolve?name=${encodeURIComponent(
        name
      )}&type=${encodeURIComponent(rtype)}&cache=${useCache ? "on" : "off"}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setData(j);
      setOpenHop(null);
      setTimeout(() => setIsAnimating(true), 300);
    } catch (e) {
      setError(
        "Unable to connect to DNS resolver. Try using the 'Paste JSON' option instead."
      );
    } finally {
      setLoading(false);
    }
  }

  function loadSample() {
    setData(SAMPLE);
    setOpenHop(null);
    setIsAnimating(false);
    setAnimStep(0);
    setAnimResolvedIPs([]);
    setTimeout(() => setIsAnimating(true), 300);
  }

  function loadFromJson() {
    try {
      const j = JSON.parse(jsonText);
      setData(j);
      setError("");
      setOpenHop(null);
      setIsAnimating(false);
      setTimeout(() => setIsAnimating(true), 300);
    } catch (e) {
      setError("Invalid JSON. Paste an exact /resolve response.");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-10"
        >
          <div className="mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70 backdrop-blur">
              <span className="inline-block size-1.5 rounded-full bg-red-500" />
              Live DNS path visualizer
            </div>

            <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              <span className="inline-flex items-center gap-3">
                <Globe className="h-8 w-8 text-red-500" />
                DNS Resolution Explorer
              </span>
            </h1>

            <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm text-white/60">
              Visualize how a domain is resolved through the DNS hierarchy.
              Inspect each hop, timing, and the final IPs.
            </p>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                onClick={loadSample}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90 shadow-sm transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
              >
                <Zap className="h-4 w-4" />
                Load sample
              </button>

              <button
                onClick={() => setShowJsonInput(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-red-800 px-3 py-1.5 text-sm text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
              >
                <Link className="h-4 w-4" />
                Paste JSON
              </button>

              <button
                onClick={() => setShowHelp(true)}
                className="group inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-white/70 transition hover:text-white"
              >
                <span className="underline decoration-white/20 underline-offset-4 group-hover:decoration-white/60">
                  How it works
                </span>
              </button>
            </div>
          </div>
        </motion.header>

        {/* Controls */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative mx-auto mt-8 max-w-6xl rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur"
        >
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            {/* Backend URL */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-white/50">
                Backend URL
              </label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://dns-explorer.onrender.com"
                className="w-full h-[40px] rounded-lg border border-white/10 bg-black/40 px-3.5 text-sm text-white/90 placeholder:text-white/30 focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
            </div>

            {/* Domain */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-white/50">
                Domain
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="example.com"
                className="w-full h-[40px] rounded-lg border border-white/10 bg-black/40 px-3.5 text-sm text-white/90 placeholder:text-white/30 focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
            </div>

            {/* Type */}
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">
                Type
              </label>
              <div className="relative">
                <select
                  value={rtype}
                  onChange={(e) => setRtype(e.target.value)}
                  className="w-full h-[40px] appearance-none rounded-lg border border-white/10 bg-black/40 px-3.5 pr-8 text-sm text-white/90 focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                >
                  <option value="A">A (IPv4)</option>
                  <option value="AAAA">AAAA (IPv6)</option>
                  <option value="CNAME">CNAME</option>
                </select>

                {/* Dropdown arrow */}
                <svg
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {/* Cache toggle */}
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">
                Cache
              </label>
              <button
                onClick={() => setUseCache(!useCache)}
                className={`relative flex h-[30px] w-[50px] items-center rounded-full border transition-all duration-200 ${
                  useCache
                    ? "justify-end border-red-500/40 bg-red-600/80"
                    : "justify-start border-white/10 bg-black/40"
                }`}
              >
                <span className="inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-200" />
              </button>
            </div>

            {/* Resolve button */}
            <div className="md:col-span-6 flex justify-end">
              <button
                onClick={runQuery}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-4 h-[35px] text-xs text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-white/10"
              >
                {loading ? (
                  <>
                    <RefreshCcw className="h-4 w-4 animate-spin" />
                    Resolving…
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4" />
                    Resolve
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            </div>
          )}
        </motion.section>

        {/* DNS Animation */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-black border border-gray-800 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium flex items-center gap-2 text-white font-semibold">
                <Activity className="w-4 h-4 text-red-500" />
                DNS Resolution Flow
              </h2>
              <button
                onClick={resetAnimation}
                className="bg-gray-900 hover:bg-gray-800 text-white px-2.5 py-1 rounded text-xs flex items-center gap-1 transition-colors border border-gray-700"
              >
                <RefreshCcw className="w-3 h-3" />
                Replay
              </button>
            </div>

            <DnsResolutionAnimation
              hops={hops}
              isAnimating={isAnimating}
              onNodeHover={setHoveredNode}
              hoveredNode={hoveredNode}
              onStepChange={setAnimStep}
              onResolved={setAnimResolvedIPs}
            />

            {/* Minimal step tracking */}
            {data && narrationLines.length > 0 && (
              <div className="mt-6 rounded-lg border border-gray-800 bg-black/60 backdrop-blur-sm">
                <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      Resolution Steps
                    </span>
                    <span className="text-xs text-gray-400">
                      ({Math.min(animStep, narrationLines.length)}/
                      {narrationLines.length})
                    </span>
                  </div>
                  <button
                    className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded border border-gray-700 hover:border-gray-600"
                    onClick={() => setShowLearnMore(true)}
                  >
                    Learn More
                  </button>
                </div>

                <div className="max-h-48 overflow-auto">
                  {narrationLines.map((line, i) => {
                    const isCurrentStep =
                      i === Math.min(animStep - 1, narrationLines.length - 1);
                    const isCompleted = i < animStep;

                    return (
                      <div
                        key={i}
                        className={`px-4 py-2 border-b border-gray-800/50 last:border-b-0 transition-all duration-300 ${
                          isCurrentStep
                            ? "bg-red-500/10 border-l-4 border-l-red-500"
                            : isCompleted
                            ? "opacity-70"
                            : "opacity-40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                              isCurrentStep
                                ? "bg-red-500 text-white"
                                : isCompleted
                                ? "bg-gray-600 text-white"
                                : "bg-gray-700 text-gray-400"
                            }`}
                          >
                            {isCompleted && !isCurrentStep ? "✓" : i + 1}
                          </div>
                          <div
                            className={`text-sm font-mono ${
                              isCurrentStep
                                ? "text-white"
                                : isCompleted
                                ? "text-gray-300"
                                : "text-gray-500"
                            }`}
                          >
                            {line}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Minimal completion summary */}
                {animResolvedIPs.length > 0 && (
                  <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">
                        Resolved to {animResolvedIPs.length} IP
                        {animResolvedIPs.length > 1 ? "s" : ""}
                      </span>
                      <div className="flex gap-1">
                        {animResolvedIPs.slice(0, 2).map((ip, index) => (
                          <span
                            key={index}
                            className="text-xs font-mono bg-gray-800 text-gray-300 px-2 py-1 rounded"
                          >
                            {ip}
                          </span>
                        ))}
                        {animResolvedIPs.length > 2 && (
                          <span className="text-xs text-gray-500">
                            +{animResolvedIPs.length - 2}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Summary Dashboard */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <SummaryDashboard data={data} />
          </motion.div>
        )}

        {/* Hop Details Table */}
        {data && hops.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-card border border-border rounded-lg p-4"
          >
            <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              Hop Details
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-muted-foreground pb-2 font-medium">
                      Step
                    </th>
                    <th className="text-left text-muted-foreground pb-2 font-medium">
                      Server
                    </th>
                    <th className="text-left text-muted-foreground pb-2 font-medium">
                      Type
                    </th>
                    <th className="text-left text-muted-foreground pb-2 font-medium">
                      RTT
                    </th>
                    <th className="text-left text-muted-foreground pb-2 font-medium">
                      Status
                    </th>
                    <th className="text-left text-muted-foreground pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {hops.map((hop, index) => {
                    const label = detectHopLabel(hop.server, hop);
                    return (
                      <motion.tr
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.8 + index * 0.05 }}
                        className="border-b border-border hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-2 text-foreground font-medium">
                          {hop.step}
                        </td>
                        <td className="py-2 font-mono text-muted-foreground">
                          {hop.server}
                        </td>
                        <td className="py-2">
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-medium">
                            {label}
                          </span>
                        </td>
                        <td className="py-2 text-foreground">{hop.rtt_ms}ms</td>
                        <td className="py-2">
                          {hop.answer?.length > 0 ? (
                            <span className="text-primary text-xs">
                              ✓ Answer
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              → Referral
                            </span>
                          )}
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => setOpenHop(hop)}
                            className="bg-muted hover:bg-muted/80 text-foreground px-2 py-1 rounded text-xs transition-colors"
                          >
                            Details
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {!data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center text-muted-foreground py-12"
          >
            <Globe className="w-12 h-12 mx-auto mb-3 text-primary opacity-50" />
            <p className="text-sm">
              Run a query or click{" "}
              <span className="font-medium text-primary">Sample</span> to see
              the DNS resolution flow.
            </p>
          </motion.div>
        )}

        {/* Complete Help Guide Modal */}
        {showHelp && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur z-50 flex items-center justify-center p-4">
            <div className="bg-black border border-gray-700 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <h2 className="text-2xl font-bold text-white">
                  Complete DNS Guide
                </h2>
                <button
                  onClick={() => setShowHelp(false)}
                  className="text-gray-400 hover:text-white transition-colors text-xl"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 space-y-8 overflow-y-auto max-h-[75vh]">
                {/* What is DNS */}
                <section className="space-y-4">
                  <h3 className="text-xl font-bold text-red-400">
                    What is DNS Resolution?
                  </h3>
                  <div className="text-gray-300 space-y-3">
                    <p>
                      DNS (Domain Name System) is like the internet's phone
                      book. When you type "google.com" in your browser, DNS
                      translates that human-readable name into an IP address
                      like "172.217.19.36" that computers use to communicate.
                    </p>
                    <p>
                      <strong className="text-white">
                        Why is this important?
                      </strong>{" "}
                      Without DNS, you'd have to memorize IP addresses for every
                      website you visit. DNS makes the internet user-friendly
                      and enables websites to change servers without affecting
                      users.
                    </p>
                  </div>
                </section>

                {/* When DNS Happens */}
                <section className="space-y-4">
                  <h3 className="text-xl font-bold text-red-400">
                    When Does DNS Resolution Occur?
                  </h3>
                  <div className="text-gray-300 space-y-2">
                    <p>
                      <strong className="text-white">Every time you:</strong>
                    </p>
                    <ul className="ml-6 space-y-1">
                      <li>• Visit a website in your browser</li>
                      <li>• Send an email</li>
                      <li>• Use any app that connects to the internet</li>
                      <li>• Connect to online services, APIs, or databases</li>
                    </ul>
                    <p className="mt-3">
                      DNS lookups happen behind the scenes, usually taking
                      20-100 milliseconds. Your device caches results to speed
                      up future requests.
                    </p>
                  </div>
                </section>

                {/* Record Types */}
                <section className="space-y-4">
                  <h3 className="text-xl font-bold text-red-400">
                    DNS Record Types Explained
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                        <h4 className="font-bold text-white mb-2">
                          A Record (IPv4)
                        </h4>
                        <p className="text-gray-300 text-sm mb-2">
                          Maps domain to IPv4 address
                        </p>
                        <div className="bg-black p-2 rounded font-mono text-xs text-green-400">
                          google.com → 172.217.19.36
                        </div>
                      </div>
                      <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                        <h4 className="font-bold text-white mb-2">
                          AAAA Record (IPv6)
                        </h4>
                        <p className="text-gray-300 text-sm mb-2">
                          Maps domain to IPv6 address
                        </p>
                        <div className="bg-black p-2 rounded font-mono text-xs text-green-400">
                          google.com → 2607:f8b0:4004:c1b::65
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                        <h4 className="font-bold text-white mb-2">
                          CNAME Record
                        </h4>
                        <p className="text-gray-300 text-sm mb-2">
                          Creates an alias pointing to another domain
                        </p>
                        <div className="bg-black p-2 rounded font-mono text-xs text-blue-400">
                          www.example.com → example.com
                        </div>
                      </div>
                      <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                        <h4 className="font-bold text-white mb-2">NS Record</h4>
                        <p className="text-gray-300 text-sm mb-2">
                          Specifies authoritative nameservers
                        </p>
                        <div className="bg-black p-2 rounded font-mono text-xs text-purple-400">
                          example.com → ns1.provider.com
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* How Resolution Works */}
                <section className="space-y-4">
                  <h3 className="text-xl font-bold text-red-400">
                    How DNS Resolution Works
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-gray-900/30 p-4 rounded-lg border border-gray-800">
                      <h4 className="font-bold text-white mb-3">
                        Step-by-Step Process:
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded font-bold">
                            1
                          </span>
                          <div>
                            <p className="text-white font-medium">
                              Browser checks local cache
                            </p>
                            <p className="text-gray-400 text-sm">
                              If domain was recently visited, use cached IP
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded font-bold">
                            2
                          </span>
                          <div>
                            <p className="text-white font-medium">
                              Query recursive resolver
                            </p>
                            <p className="text-gray-400 text-sm">
                              Your ISP's DNS server or public DNS like 8.8.8.8
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded font-bold">
                            3
                          </span>
                          <div>
                            <p className="text-white font-medium">
                              Root server query
                            </p>
                            <p className="text-gray-400 text-sm">
                              Asks root server: "Who handles .com domains?"
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded font-bold">
                            4
                          </span>
                          <div>
                            <p className="text-white font-medium">
                              TLD server query
                            </p>
                            <p className="text-gray-400 text-sm">
                              Asks .com server: "Who handles example.com?"
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded font-bold">
                            5
                          </span>
                          <div>
                            <p className="text-white font-medium">
                              Authoritative server query
                            </p>
                            <p className="text-gray-400 text-sm">
                              Gets final answer with IP address
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Example Walkthrough */}
                <section className="space-y-4">
                  <h3 className="text-xl font-bold text-red-400">
                    Example Walkthrough
                  </h3>
                  <div className="bg-gray-900/30 p-4 rounded-lg border border-gray-800">
                    <h4 className="font-bold text-white mb-3">
                      Looking up "www.google.com":
                    </h4>
                    <div className="space-y-2 font-mono text-sm">
                      <div className="text-gray-400">
                        Query: www.google.com A?
                      </div>
                      <div className="text-red-400">
                        Root Server: "Ask .com TLD server at 192.5.6.30"
                      </div>
                      <div className="text-purple-400">
                        TLD Server: "Ask Google's nameserver at 216.239.32.10"
                      </div>
                      <div className="text-green-400">
                        Authoritative: "www.google.com is 172.217.19.36"
                      </div>
                      <div className="text-white">
                        Result: Your browser connects to 172.217.19.36
                      </div>
                    </div>
                  </div>
                </section>

                {/* Using This Tool */}
                <section className="space-y-4">
                  <h3 className="text-xl font-bold text-red-400">
                    How to Use This Tool
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="font-bold text-white">Quick Start:</h4>
                      <ol className="text-gray-300 space-y-2 text-sm">
                        <li>1. Click "Sample" to see a demo resolution</li>
                        <li>2. Enter any domain name in the Domain field</li>
                        <li>3. Select record type (A, AAAA, CNAME)</li>
                        <li>4. Click "Resolve" to see the process</li>
                        <li>5. Watch the animated visualization</li>
                      </ol>
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-bold text-white">Features:</h4>
                      <ul className="text-gray-300 space-y-2 text-sm">
                        <li>• Real-time DNS resolution visualization</li>
                        <li>• Performance metrics and timing</li>
                        <li>• Detailed technical information</li>
                        <li>• Support for JSON input/output</li>
                        <li>• Educational tooltips and explanations</li>
                      </ul>
                    </div>
                  </div>
                </section>

                {/* Common Issues */}
                <section className="space-y-4">
                  <h3 className="text-xl font-bold text-red-400">
                    Common DNS Issues
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                      <h4 className="font-bold text-white mb-2">NXDOMAIN</h4>
                      <p className="text-gray-300 text-sm">
                        Domain doesn't exist or is misspelled
                      </p>
                    </div>
                    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                      <h4 className="font-bold text-white mb-2">Timeout</h4>
                      <p className="text-gray-300 text-sm">
                        DNS server not responding
                      </p>
                    </div>
                    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                      <h4 className="font-bold text-white mb-2">
                        High Latency
                      </h4>
                      <p className="text-gray-300 text-sm">
                        Slow DNS servers or network issues
                      </p>
                    </div>
                    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                      <h4 className="font-bold text-white mb-2">
                        Cache Issues
                      </h4>
                      <p className="text-gray-300 text-sm">
                        Stale records or propagation delays
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
        {/* Learn More Modal */}
        {showLearnMore && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-4">
            <div className="bg-black border border-gray-700 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">
                  DNS Resolution Process
                </h2>
                <button
                  onClick={() => setShowLearnMore(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-white">
                      How DNS Resolution Works
                    </h3>
                    <div className="space-y-3 text-sm text-gray-300">
                      <p>
                        DNS resolution is a hierarchical process that translates
                        human-readable domain names into IP addresses that
                        computers use to communicate.
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-red-500 font-bold">◉</span>
                          <span>
                            <strong>Root Servers:</strong> Top-level authority
                            that knows TLD server locations
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-purple-500 font-bold">⬣</span>
                          <span>
                            <strong>TLD Servers:</strong> Manage top-level
                            domains (.com, .org, etc.)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-green-500 font-bold">◆</span>
                          <span>
                            <strong>Authoritative:</strong> Final authority with
                            actual DNS records
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-500 font-bold">▣</span>
                          <span>
                            <strong>Cache:</strong> Stored results from previous
                            queries
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-white">
                      Technical Details
                    </h3>
                    <div className="space-y-3 text-sm text-gray-300">
                      <div>
                        <strong className="text-white">Query Types:</strong>
                        <ul className="mt-1 space-y-1 ml-4">
                          <li>• A records: IPv4 addresses</li>
                          <li>• AAAA records: IPv6 addresses</li>
                          <li>• CNAME: Canonical name aliases</li>
                          <li>• NS: Nameserver delegations</li>
                        </ul>
                      </div>
                      <div>
                        <strong className="text-white">
                          Response Sections:
                        </strong>
                        <ul className="mt-1 space-y-1 ml-4">
                          <li>• Answer: Direct responses to queries</li>
                          <li>• Authority: NS records for delegation</li>
                          <li>• Additional: Glue records and extra data</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="text-lg font-medium text-white mb-3">
                    Resolution Flow
                  </h3>
                  <div className="text-sm text-gray-300 space-y-2">
                    <p>
                      1. <strong>Recursive Query:</strong> Client asks resolver
                      for domain IP
                    </p>
                    <p>
                      2. <strong>Root Query:</strong> Resolver queries root
                      server for TLD information
                    </p>
                    <p>
                      3. <strong>TLD Query:</strong> Resolver queries TLD server
                      for authoritative nameservers
                    </p>
                    <p>
                      4. <strong>Authoritative Query:</strong> Resolver queries
                      authoritative server for final answer
                    </p>
                    <p>
                      5. <strong>Response:</strong> IP address returned to
                      client and cached for future use
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* JSON Input Modal */}
        {showJsonInput && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[80vh]">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">
                  Paste DNS Resolution JSON
                </h2>
                <button
                  onClick={() => setShowJsonInput(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 space-y-3">
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder="Paste your /resolve JSON response here..."
                  className="w-full h-48 p-3 border border-input rounded font-mono text-sm bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowJsonInput(false)}
                    className="bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      loadFromJson();
                      setShowJsonInput(false);
                    }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded text-sm transition-colors"
                  >
                    Load JSON
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <DetailsModal openHop={openHop} onClose={() => setOpenHop(null)} />
    </div>
  );
}
