module rel_addr
#(
	parameter MDATAW = 8,
	parameter FFTSIZ = 3,

	parameter USEFFT = 1
)
(
	input               srf, inv,
	input  [MDATAW-1:0] in,
	input  [MDATAW-1:0] addr,
	output [MDATAW-1:0] out
);

generate 

	if (USEFFT) begin

		reg [FFTSIZ-1:0] aux;

		integer i;

		always @ (*) begin
			for (i = 0; i < FFTSIZ; i = i+1) begin : norm
				aux[i] <= in[FFTSIZ-1-i];
			end
		end

		wire [MDATAW-1:0] add = (inv) ? {in[MDATAW-1:FFTSIZ], aux} : in;

		assign out = (srf) ? add + addr: addr;

	end else

		assign out = (srf) ? in  + addr: addr;

endgenerate

endmodule 