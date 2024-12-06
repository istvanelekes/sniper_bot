// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import "./ISwapRouter02.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SniperTrade {
    address public immutable owner;

    // Router02 addresses on Uniswap compatible DEX's
    address private constant ROUTER_V2 = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address private constant ROUTER_V3 = 0x2626664c2603336E57B271c5C0b26F421741e481;

    enum RouterVersion { V2, V3 }

    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "SniperTrade: caller is not the owner!"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Don't allow contract to receive Ether by mistake
    fallback() external {
        revert();
    }

    /**
     * Buy a token on Uniswap or compatible Dex's
     * @param _routerV Uniswap Router version(ex. V2, V3)
     * @param _tokenIn Token address to sell
     * @param _amount Token amount to sell
     * @param _tokenOut Token address to buy
     * @param _fee swap fee
     */
    function buyToken(
        RouterVersion _routerV,
        address _tokenIn,
        uint256 _amount,
        address _tokenOut,
        uint24 _fee
    ) external onlyOwner {
        uint256 tokenInBalance = IERC20(_tokenIn).balanceOf(address(this));
        require(tokenInBalance > _amount, "SniperTrade: token balance must be greater than amount");

        // Swap the amount of tokenIn and expect to get X amount of tokenOut
        if (_routerV == RouterVersion.V2) {
            _swapOnV2(_tokenIn, _amount, _tokenOut, 0);
        } else {
            _swapOnV3(_tokenIn, _amount, _tokenOut, 0, _fee);
        }
    }

    /**
     * Sell a token on Uniswap or compatible Dex's
     * @param _routerV Uniswap Router version(ex. V2, V3)
     * @param _tokenIn Token address to sell
     * @param _tokenOut Token address to buy
     * @param _fee swap fee
     */
    function sellToken(
        RouterVersion _routerV,
        address _tokenIn,
        address _tokenOut,
        uint24 _fee
    ) external onlyOwner {
        uint256 amountIn = IERC20(_tokenIn).balanceOf(address(this));
        require(amountIn > 0, "SniperTrade: sell amount must be greater than 0");

        // Swap the amount of tokenIn and expect to get X amount of tokenOut
        if (_routerV == RouterVersion.V2) {
            _swapOnV2(_tokenIn, amountIn, _tokenOut, 0);
        } else {
            _swapOnV3(_tokenIn, amountIn, _tokenOut, 0, _fee);
        }
    }

    /**
     * Withdraw any tokens accidentally sent or extra balance remaining.
     * @param _tokenAddress Token address to withdraw.
     */
    function withdrawToken(address _tokenAddress) public onlyOwner {
        uint256 balance = IERC20(_tokenAddress).balanceOf(address(this));
        IERC20(_tokenAddress).transfer(owner, balance);
    }

    /**
     * Withdraw x percent of tokens extra balance remaining.
     * @param _tokenAddress Token address to withdraw.
     * @param _percent Token amount percentage
     */
    function withdrawTokenAtPercent(address _tokenAddress, uint256 _percent) public onlyOwner {
        uint256 balance = IERC20(_tokenAddress).balanceOf(address(this));
        uint256 amount = balance * _percent / 100;
        IERC20(_tokenAddress).transfer(owner, amount);
    }

    /// Withdraw Ether from the contract
    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;

        (bool succes, ) = payable(msg.sender).call{ value: balance }("");
        require(succes, "Failed to send Ether");
    }

    // -- INTERNAL FUNCTIONS -- //

    function _swapOnV2(
        address _tokenIn,
        uint256 _amountIn,
        address _tokenOut,
        uint256 _amountOut
    ) internal {
        // Approve token to swap
        IERC20(_tokenIn).approve(ROUTER_V2, _amountIn);

        address[] memory path = new address[](2);
        path[0] = _tokenIn;
        path[1] = _tokenOut;

        uint deadline = block.timestamp + 300;

        // Perform swap
        ISwapRouter02(ROUTER_V2).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            _amountIn,
            _amountOut,
            path,
            address(this),
            deadline
        );
    }

    function _swapOnV3(
        address _tokenIn,
        uint256 _amountIn,
        address _tokenOut,
        uint256 _amountOut,
        uint24 _fee
    ) internal {
        // Approve token to swap
        IERC20(_tokenIn).approve(ROUTER_V3, _amountIn);

        // Setup swap parameters
        ISwapRouter02.ExactInputSingleParams memory params = ISwapRouter02
            .ExactInputSingleParams({
                tokenIn: _tokenIn,
                tokenOut: _tokenOut,
                fee: _fee,
                recipient: address(this),
                amountIn: _amountIn,
                amountOutMinimum: _amountOut,
                sqrtPriceLimitX96: 0
            });

        // Perform swap
        ISwapRouter02(ROUTER_V3).exactInputSingle(params);
    }
}
