figure; clf;
drawVerticalSpringCentered(0, 1, 0, 'Turns', 4, 'Amplitude', 0.15, ...
    'LeadTop', 0.15, 'LeadBottom', 0.15, 'LineWidth', 2);
xlim([-0.4 0.4]); ylim([-0.1 1.1]);


function h = drawVerticalSpringCentered(x0, yTop, yBottom, varargin)
% drawVerticalSpringCentered
% Vertical spring drawn with straight line segments.
% - Top and bottom vertical leads are centered at x = x0 and CONNECTED.
% - Zig-zag diagonals have constant |slope|.
% - First and last diagonals are HALF-WIDTH in x (center->side and side->center),
%   and correspondingly HALF-STEP in y to keep |slope| constant.

p = inputParser;
p.addParameter('LeadTop',    []);   % top vertical lead length
p.addParameter('LeadBottom', []);   % bottom vertical lead length
p.addParameter('Amplitude',  []);   % half-width of spring (A)
p.addParameter('Turns',      8);    % number of full-width zig-zag pairs
p.addParameter('LineWidth',  2);
p.parse(varargin{:});
opt = p.Results;

L = abs(yTop - yBottom);
if isempty(opt.LeadTop),    opt.LeadTop    = 0.10 * L; end
if isempty(opt.LeadBottom), opt.LeadBottom = 0.10 * L; end
if isempty(opt.Amplitude),  opt.Amplitude  = 0.15 * L; end

A  = opt.Amplitude;
xL = x0 - A;
xR = x0 + A;

% Handle direction (y increasing or decreasing)
sgn = sign(yBottom - yTop);
if sgn == 0, sgn = 1; end

% Lead endpoints (where zig-zag begins/ends)
y1 = yTop    + sgn * opt.LeadTop;      % end of top lead
y2 = yBottom - sgn * opt.LeadBottom;   % start of bottom lead

% --- Build zig-zag points ---
% Total diagonal segments = (2*Turns full-width) + (2 half-width ends)
% To keep constant |slope|: half-width segments use half the vertical step.
nFull = 2 * opt.Turns;
dY = (y2 - y1) / (nFull + 1);  % because total = (dY/2) + nFull*dY + (dY/2)

nPts = nFull + 3;              % segments + 1 = (nFull+2)+1
xx = zeros(1, nPts);
yy = zeros(1, nPts);

% X: start at center, then alternate sides, end at center
xx(1) = x0;
for i = 2:(nPts-1)
    if mod(i,2) == 0
        xx(i) = xL;   % start to left; swap xL/xR if you want it to start right
    else
        xx(i) = xR;
    end
end
xx(end) = x0;

% Y: half-step for first and last diagonal, full step for the rest
yy(1) = y1;
yy(2) = y1 + dY/2;
for i = 3:(nPts-1)
    yy(i) = yy(i-1) + dY;
end
yy(end) = y2;

% --- Plot ---
holdState = ishold;
hold on;

% top vertical lead (connected)
h(1) = plot([x0 x0], [yTop y1], 'k-', 'LineWidth', opt.LineWidth);

% zig-zag
h(2) = plot(xx, yy, 'k-', 'LineWidth', opt.LineWidth);

% bottom vertical lead (connected)
h(3) = plot([x0 x0], [y2 yBottom], 'k-', 'LineWidth', opt.LineWidth);

if ~holdState, hold off; end
axis equal;
end
