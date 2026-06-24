# TODO
- split up parser into an actual parser & static analyser stuff
    - parser should create a basic AST that just stores the "shape" of the code
    - analyzer/binder should take the basic AST and finalise details in it (is this variable local, captured, or an argument (and store info on accessing it)?, what method should this binary operator use?, etc)
    - compiler should be able to look at this ast and emit code with no major decisions, only stuff that depends on knowing the working stack size (i.e. best patterns to access var)
- allow operator overloading via types, not the LUT bs
- implement importing
- nuke builtins and fully use imported symbols w/ natives
- also like allow for describing more than just 3 types